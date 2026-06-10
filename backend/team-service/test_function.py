"""
Backend tests for team-service.
Run: pytest test_function.py -v
"""

import json
import os
import pytest
from unittest.mock import MagicMock, patch, call
from bson import ObjectId
from datetime import datetime, timezone

os.environ["IS_LOCAL"] = "true"
os.environ["JWT_SECRET"] = "test-secret"

# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event(method, path, body=None, token=None):
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    return {
        "requestContext": {"http": {"method": method, "path": path}},
        "headers": headers,
        "body": json.dumps(body) if body else None,
        "queryStringParameters": None,
    }


def fake_oid():
    return str(ObjectId())


# ── Auth tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_missing_fields(self):
        import function
        with patch("function.get_db") as mock_db:
            mock_db.return_value = MagicMock()
            r = function.handler(make_event("POST", "/auth/login", {}))
        assert r["statusCode"] == 400

    def test_login_invalid_credentials(self):
        import function
        mock_col = MagicMock()
        mock_col.find_one.return_value = None
        mock_col.count_documents.return_value = 1
        with patch("function.get_db") as mock_db:
            mock_db.return_value.__getitem__ = lambda s, k: mock_col
            r = function.handler(make_event("POST", "/auth/login", {
                "username": "nobody", "password": "wrong"
            }))
        assert r["statusCode"] == 401

    def test_seed_endpoint(self):
        import function
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 0
        mock_col.insert_many.return_value = MagicMock()
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("POST", "/auth/seed"))
        assert r["statusCode"] == 200


# ── RBAC tests ────────────────────────────────────────────────────────────────

class TestRBAC:
    def setup_method(self):
        """Generate tokens for each role."""
        from auth import create_token
        oid = fake_oid()
        self.admin_token    = create_token(oid, "admin",  "admin")
        self.manager_token  = create_token(oid, "mgr",    "manager")
        self.contrib_token  = create_token(oid, "contrib","contributor")
        self.viewer_token   = create_token(oid, "viewer", "viewer")

    def _db_with_teams(self, teams=None):
        mock_col = MagicMock()
        mock_col.find.return_value = MagicMock(sort=MagicMock(return_value=teams or []))
        mock_col.count_documents.return_value = 1
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        return mock_db

    def test_viewer_can_read_teams(self):
        import function
        mock_db = self._db_with_teams([])
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("GET", "/teams", token=self.viewer_token))
        assert r["statusCode"] == 200

    def test_viewer_cannot_create_team(self):
        import function
        mock_db = self._db_with_teams([])
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("POST", "/teams",
                                            body={"name": "X"}, token=self.viewer_token))
        assert r["statusCode"] == 403

    def test_unauthenticated_cannot_read(self):
        import function
        mock_db = self._db_with_teams([])
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("GET", "/teams"))
        assert r["statusCode"] == 401

    def test_contributor_can_create(self):
        import function
        from bson import ObjectId
        # Must include all required fields now
        mock_col = MagicMock()
        mock_col.find_one.return_value = None  # name doesn't exist yet
        inserted = MagicMock()
        inserted.inserted_id = ObjectId()
        mock_col.insert_one.return_value = inserted
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        event = make_event("POST", "/teams", token=self.contrib_token, body={
            "name":        "New Team",
            "team_leader": "Jane Smith",
            "location":    "New York",
            "department":  "Technology",
        })
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(event)
        assert r["statusCode"] == 201

    def test_contributor_cannot_delete(self):
        import function
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 1
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        tid = fake_oid()
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("DELETE", f"/teams/{tid}", token=self.contrib_token))
        assert r["statusCode"] == 403

    def test_manager_can_delete(self):
        import function
        from bson import ObjectId
        tid      = str(ObjectId())
        mock_col = MagicMock()
        mock_col.find.return_value    = MagicMock(sort=MagicMock(return_value=[]))
        mock_col.find_one.return_value = {"_id": ObjectId(tid), "name": "Test Team"}
        mock_col.update_one.return_value = MagicMock(modified_count=1)
        mock_db  = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("DELETE", f"/teams/{tid}",
                                            token=self.manager_token))
        assert r["statusCode"] == 204


# ── Teams CRUD tests ──────────────────────────────────────────────────────────

class TestTeams:
    def setup_method(self):
        from auth import create_token
        oid = fake_oid()
        self.admin_token = create_token(oid, "admin", "admin")
        self.viewer_token = create_token(oid, "viewer", "viewer")

    def _mock_db(self, find_result=None, find_one_result=None, delete_count=1):
        mock_col = MagicMock()
        mock_col.find.return_value = MagicMock(sort=MagicMock(return_value=find_result or []))
        mock_col.find_one.return_value = find_one_result
        mock_col.count_documents.return_value = 1
        ins = MagicMock()
        ins.inserted_id = ObjectId()
        mock_col.insert_one.return_value = ins
        mock_col.update_one.return_value = MagicMock(matched_count=1)
        mock_col.delete_one.return_value = MagicMock(deleted_count=delete_count)
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        return mock_db, mock_col

    def test_list_teams(self):
        import function
        mock_db, _ = self._mock_db(find_result=[])
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("GET", "/teams", token=self.viewer_token))
        assert r["statusCode"] == 200
        assert json.loads(r["body"]) == []

    def test_create_team_missing_name(self):
        import function
        mock_db, _ = self._mock_db()
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("POST", "/teams",
                                            body={"description": "x"}, token=self.admin_token))
        assert r["statusCode"] == 400

    def test_get_team_invalid_id(self):
        import function
        mock_db, _ = self._mock_db()
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("GET", "/teams/not-an-id", token=self.viewer_token))
        assert r["statusCode"] == 400

    def test_get_team_not_found(self):
        import function
        mock_db, _ = self._mock_db(find_one_result=None)
        tid = fake_oid()
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("GET", f"/teams/{tid}", token=self.viewer_token))
        assert r["statusCode"] == 404

    def test_delete_team_not_found(self):
        import function
        from bson import ObjectId
        tid      = str(ObjectId())
        mock_col = MagicMock()
        mock_col.find.return_value     = MagicMock(sort=MagicMock(return_value=[]))
        mock_col.find_one.return_value = None
        mock_col.update_one.return_value = MagicMock(modified_count=0)
        mock_db  = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("DELETE", f"/teams/{tid}",
                                            token=self.admin_token))
        assert r["statusCode"] == 404


# ── Members tests ─────────────────────────────────────────────────────────────

class TestMembers:
    def setup_method(self):
        from auth import create_token
        oid = fake_oid()
        self.admin_token = create_token(oid, "admin", "admin")

    def test_create_member_missing_team_id(self):
        import function
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 1
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("POST", "/members",
                                            body={"name": "Alice"}, token=self.admin_token))
        assert r["statusCode"] == 400

    def test_create_member_invalid_team_id(self):
        import function
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 1
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("POST", "/members",
                                            body={"name": "Alice", "team_id": "bad"},
                                            token=self.admin_token))
        assert r["statusCode"] == 400


# ── Achievements tests ────────────────────────────────────────────────────────

class TestAchievements:
    def setup_method(self):
        from auth import create_token
        oid = fake_oid()
        self.admin_token = create_token(oid, "admin", "admin")

    def _mock_db(self):
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 1
        ins = MagicMock()
        ins.inserted_id = ObjectId()
        mock_col.insert_one.return_value = ins
        mock_col.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        return mock_db

    def test_create_achievement_invalid_month(self):
        import function
        tid = fake_oid()
        mock_db = self._mock_db()
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("POST", "/achievements", body={
                "title": "Q1 Win", "team_id": tid, "month": 13, "year": 2024
            }, token=self.admin_token))
        assert r["statusCode"] == 400

    def test_list_achievements_filtered(self):
        import function
        mock_db = self._mock_db()
        event = make_event("GET", "/achievements", token=self.admin_token)
        event["queryStringParameters"] = {"month": "3", "year": "2024"}
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(event)
        assert r["statusCode"] == 200


# ── Health check ──────────────────────────────────────────────────────────────

class TestHealth:
    def test_root_health(self):
        import function
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 1
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("GET", "/"))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert body["status"] == "ok"

    def test_options_cors(self):
        import function
        mock_col = MagicMock()
        mock_col.count_documents.return_value = 1
        mock_db = MagicMock()
        mock_db.__getitem__ = lambda s, k: mock_col
        with patch("function.get_db", return_value=mock_db):
            r = function.handler(make_event("OPTIONS", "/teams"))
        assert r["statusCode"] == 204
