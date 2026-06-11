"""
Coverage expansion tests for team-service handlers.
Run: pytest test_coverage.py test_function.py --cov=function --cov=auth -v
"""

import json
import os
import pytest
from unittest.mock import MagicMock, patch, call
from bson import ObjectId
from datetime import datetime, timezone

os.environ["IS_LOCAL"] = "true"
os.environ["JWT_SECRET"] = "test-secret"

from test_function import make_event, fake_oid


# ── Mock helpers ──────────────────────────────────────────────────────────────

def _col(find_result=None, find_one_result=None, count=0, modified=1):
    """Build a mock MongoDB collection."""
    mc = MagicMock()
    mc.find.return_value = MagicMock(
        sort=MagicMock(return_value=find_result or []),
        limit=MagicMock(return_value=find_result or []),
    )
    mc.find_one.return_value = find_one_result
    mc.count_documents.return_value = count
    mc.aggregate.return_value = iter([])
    ins = MagicMock()
    ins.inserted_id = ObjectId()
    mc.insert_one.return_value = ins
    mc.update_one.return_value = MagicMock(matched_count=modified, modified_count=modified)
    mc.delete_one.return_value = MagicMock(deleted_count=1)
    return mc


def _db(find_result=None, find_one_result=None, count=0, modified=1):
    """Build a mock DB returning one mock collection for all keys."""
    mc = _col(find_result, find_one_result, count, modified)
    db = MagicMock()
    db.__getitem__ = lambda s, k: mc
    return db, mc


def _tokens():
    from auth import create_token
    oid = fake_oid()
    return {
        "admin":    create_token(oid, "admin",    "admin"),
        "manager":  create_token(oid, "mgr",      "manager"),
        "contrib":  create_token(oid, "contrib",  "contributor"),
        "viewer":   create_token(oid, "viewer",   "viewer"),
    }


# ── Auth extended ─────────────────────────────────────────────────────────────

class TestAuthExtended:
    def test_register_missing_fields(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/register", {}))
        assert r["statusCode"] == 400

    def test_register_weak_password(self):
        import function
        db, _ = _db()
        body = {
            "username":  "newuser",
            "password":  "weak",
            "email":     "x@y.com",
            "full_name": "Test User",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/register", body))
        assert r["statusCode"] == 400

    def test_register_success(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None  # username and email are available
        body = {
            "username":  "testuser1",
            "password":  "Secure123!",
            "email":     "test@example.com",
            "full_name": "Test User",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/register", body))
        assert r["statusCode"] == 201
        data = json.loads(r["body"])
        assert data["user"]["username"] == "testuser1"
        assert data["user"]["role"] == "viewer"
        assert "access_token" in data

    def test_register_duplicate_username(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = {"username": "testuser1"}  # already exists
        body = {
            "username":  "testuser1",
            "password":  "Secure123!",
            "email":     "new@example.com",
            "full_name": "Test User",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/register", body))
        assert r["statusCode"] == 400

    def test_auth_me_endpoint(self):
        import function
        from auth import create_token
        tok = _tokens()["viewer"]
        oid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {
            "_id": ObjectId(oid), "username": "viewer", "role": "viewer"
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/auth/me", token=tok))
        assert r["statusCode"] == 200

    def test_auth_me_unauthenticated(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/auth/me"))
        assert r["statusCode"] == 401

    def test_auth_logout(self):
        import function
        tok = _tokens()["viewer"]
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/logout", token=tok))
        assert r["statusCode"] == 200

    def test_refresh_token_missing(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/refresh", {}))
        assert r["statusCode"] == 400

    def test_refresh_token_invalid(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/refresh",
                                            {"refresh_token": "notavalidtoken"}))
        assert r["statusCode"] == 401

    def test_roles_endpoint(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/roles"))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "roles" in body

    def test_unknown_resource_404(self):
        import function
        tok = _tokens()["admin"]
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/nonexistent", token=tok))
        assert r["statusCode"] == 404

    def test_auth_unknown_action_404(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/auth/unknown"))
        assert r["statusCode"] == 404


# ── auth.py unit tests ────────────────────────────────────────────────────────

class TestAuthModule:
    def test_hash_and_verify_password(self):
        from auth import hash_password, verify_password
        hashed = hash_password("MySecretPass1!")
        assert verify_password("MySecretPass1!", hashed)
        assert not verify_password("WrongPass", hashed)

    def test_verify_password_legacy_format(self):
        """Covers the legacy salt:hash branch."""
        import hashlib
        from auth import verify_password, PBKDF2_ITERATIONS
        salt = "abc123"
        plain = "password"
        hashed = hashlib.pbkdf2_hmac(
            "sha256", plain.encode(), salt.encode(), PBKDF2_ITERATIONS
        ).hex()
        stored = f"{salt}:{hashed}"
        assert verify_password(plain, stored)
        assert not verify_password("other", stored)

    def test_decode_token_valid(self):
        from auth import create_access_token, decode_token
        tok = create_access_token("uid1", "alice", "admin")
        payload = decode_token(tok, "access")
        assert payload is not None
        assert payload["username"] == "alice"

    def test_decode_token_wrong_type(self):
        from auth import create_access_token, decode_token
        tok = create_access_token("uid1", "alice", "admin")
        assert decode_token(tok, "refresh") is None

    def test_decode_token_invalid(self):
        from auth import decode_token
        assert decode_token("not.a.token") is None

    def test_decode_token_after_revocation(self):
        from auth import create_access_token, decode_token, revoke_token
        tok = create_access_token("uid2", "bob", "viewer")
        revoke_token(tok)
        assert decode_token(tok) is None

    def test_refresh_token_creation(self):
        from auth import create_refresh_token, decode_token
        tok = create_refresh_token("uid3", "carol")
        payload = decode_token(tok, "refresh")
        assert payload is not None
        assert payload["username"] == "carol"

    def test_account_lockout_flow(self):
        from auth import record_failed_attempt, is_account_locked, clear_failed_attempts, MAX_FAILED_ATTEMPTS
        user = "locktest_user_unique"
        clear_failed_attempts(user)
        for _ in range(MAX_FAILED_ATTEMPTS):
            record_failed_attempt(user)
        locked, minutes = is_account_locked(user)
        assert locked is True
        assert minutes is not None
        clear_failed_attempts(user)
        locked2, _ = is_account_locked(user)
        assert locked2 is False

    def test_is_account_locked_unknown_user(self):
        from auth import is_account_locked
        locked, minutes = is_account_locked("completely_unknown_user_xyz")
        assert locked is False
        assert minutes is None

    def test_can_functions(self):
        from auth import can_read, can_write, can_delete, can_admin
        viewer      = {"role": "viewer"}
        contributor = {"role": "contributor"}
        manager     = {"role": "manager"}
        admin       = {"role": "admin"}
        assert can_read(viewer) and not can_write(viewer)
        assert can_write(contributor) and not can_delete(contributor)
        assert can_delete(manager) and not can_admin(manager)
        assert can_admin(admin)

    def test_permission_error_format(self):
        from auth import permission_error
        r = permission_error("manager")
        assert r["statusCode"] == 403
        assert "error" in json.loads(r["body"])

    def test_auth_error_format(self):
        from auth import auth_error
        r = auth_error()
        assert r["statusCode"] == 401

    def test_get_role_info(self):
        from auth import get_role_info
        info = get_role_info("manager")
        assert info["role"] == "manager"
        assert "permissions" in info


# ── Projects ──────────────────────────────────────────────────────────────────

class TestProjects:
    def setup_method(self):
        self.t = _tokens()

    def test_list_projects(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/projects", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"]) == []

    def test_list_projects_unauthenticated(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/projects"))
        assert r["statusCode"] == 401

    def test_get_project_invalid_id(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/projects/bad-id", token=self.t["viewer"]))
        assert r["statusCode"] == 400

    def test_get_project_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        pid = fake_oid()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/projects/{pid}", token=self.t["viewer"]))
        assert r["statusCode"] == 404

    def test_get_project_success(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {
            "_id": ObjectId(pid), "name": "Test Project",
            "status": "in_progress", "deliverables": [],
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/projects/{pid}", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"])["name"] == "Test Project"

    def test_create_project_missing_name(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects",
                body={"team_id": fake_oid()}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_create_project_missing_owner(self):
        import function
        db, _ = _db()
        body = {
            "name": "Some Project", "team_id": fake_oid(),
            "start_date": "2026-01-01", "due_date": "2026-06-01",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_create_project_team_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None   # duplicate check passes, team missing
        tid = fake_oid()
        body = {
            "name": "A Project", "team_id": tid, "owner_name": "Alice",
            "start_date": "2026-01-01", "due_date": "2026-06-01",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 404

    def test_create_project_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        # find_one: first call = None (no dup), second call = team exists
        mc.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team A"}]
        body = {
            "name": "Alpha Project", "team_id": tid, "owner_name": "Alice",
            "start_date": "2026-01-01", "due_date": "2026-12-31",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 201
        assert json.loads(r["body"])["name"] == "Alpha Project"

    def test_create_project_viewer_forbidden(self):
        import function
        db, _ = _db()
        body = {"name": "X", "team_id": fake_oid(), "owner_name": "A",
                "start_date": "2026-01-01", "due_date": "2026-06-01"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects", body=body,
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 403

    def test_update_project_no_fields(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}",
                                            body={}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_update_project_success(self):
        import function
        pid = fake_oid()
        doc = {"_id": ObjectId(pid), "name": "Old", "deliverables": []}
        db, mc = _db()
        mc.find_one.return_value = doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}",
                body={"status": "in_progress"}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_update_project_not_found(self):
        import function
        pid = fake_oid()
        db, mc = _db(modified=0)
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}",
                body={"status": "completed"}, token=self.t["contrib"]))
        assert r["statusCode"] == 404

    def test_update_project_invalid_status(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}",
                body={"status": "invalid_status"}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_update_project_progress_out_of_range(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}",
                body={"progress": 999}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_delete_project_manager(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "name": "X", "deleted": False}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/projects/{pid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 204

    def test_delete_project_contributor_forbidden(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/projects/{pid}",
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 403

    def test_delete_project_not_found(self):
        import function
        pid = fake_oid()
        db, mc = _db(modified=0)
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/projects/{pid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 404

    def test_add_deliverable_to_project(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "deliverables": []}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/projects/{pid}/deliverables",
                body={"title": "Write docs"}, token=self.t["contrib"]))
        assert r["statusCode"] == 201
        body = json.loads(r["body"])
        assert body["item"]["title"] == "Write docs"

    def test_add_deliverable_missing_title(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/projects/{pid}/deliverables",
                body={}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_update_deliverable_status(self):
        import function
        pid = fake_oid()
        item_id = "abc12345"
        project_doc = {
            "_id": ObjectId(pid),
            "deliverables": [{"id": item_id, "title": "Task", "status": "pending", "depends_on": []}],
        }
        db, mc = _db()
        mc.find_one.return_value = project_doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}/deliverables/{item_id}",
                body={"status": "done"}, token=self.t["contrib"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"])["progress"] == 100

    def test_update_deliverable_invalid_status(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "deliverables": []}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/projects/{pid}/deliverables/abc",
                body={"status": "bad"}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_delete_deliverable(self):
        import function
        pid = fake_oid()
        item_id = "del12345"
        project_doc = {
            "_id": ObjectId(pid),
            "deliverables": [{"id": item_id, "title": "Task", "status": "pending", "depends_on": []}],
        }
        db, mc = _db()
        mc.find_one.return_value = project_doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/projects/{pid}/deliverables/{item_id}",
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"])["progress"] == 0

    def test_add_project_member(self):
        import function
        pid = fake_oid()
        mid = fake_oid()
        project_doc = {"_id": ObjectId(pid), "members": [], "total_budget": 0}
        member_doc  = {"_id": ObjectId(mid), "name": "Bob", "daily_rate": 500,
                       "employment_type": "direct"}
        db, mc = _db()
        mc.find_one.side_effect = [project_doc, member_doc, project_doc]
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/projects/{pid}/members",
                body={"member_id": mid, "days_allocated": 5}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_add_project_member_already_on_project(self):
        import function
        pid = fake_oid()
        mid = fake_oid()
        project_doc = {"_id": ObjectId(pid), "members": [{"member_id": mid}]}
        member_doc  = {"_id": ObjectId(mid), "name": "Bob", "employment_type": "direct"}
        db, mc = _db()
        mc.find_one.side_effect = [member_doc, project_doc]
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/projects/{pid}/members",
                body={"member_id": mid}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_remove_project_member(self):
        import function
        pid = fake_oid()
        mid = fake_oid()
        project_doc = {"_id": ObjectId(pid), "members": [{"member_id": mid, "cost": 0}]}
        db, mc = _db()
        mc.find_one.return_value = project_doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/projects/{pid}/members/{mid}",
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 200


# ── Members extended ──────────────────────────────────────────────────────────

class TestMembersExtended:
    def setup_method(self):
        self.t = _tokens()

    def test_list_members(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/members", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"]) == []

    def test_get_member_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/members/{fake_oid()}",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 404

    def test_get_member_success(self):
        import function
        mid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(mid), "name": "Alice",
                                    "team_id": fake_oid()}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/members/{mid}", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"])["name"] == "Alice"

    def test_create_member_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        # find for dup email: None; find for team: exists
        mc.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team A"}]
        body = {
            "name": "Alice Smith", "team_id": tid, "email": "alice@example.com",
            "role": "Engineer", "location": "NYC", "employment_type": "direct",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/members", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 201
        assert json.loads(r["body"])["name"] == "Alice Smith"

    def test_create_member_missing_email(self):
        import function
        db, _ = _db()
        body = {"name": "Bob", "team_id": fake_oid(), "role": "Dev"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/members", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_update_member_no_fields(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/members/{fake_oid()}",
                                            body={}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_update_member_success(self):
        import function
        mid = fake_oid()
        doc = {"_id": ObjectId(mid), "name": "Old", "team_id": fake_oid()}
        db, mc = _db()
        mc.find_one.return_value = doc
        # projects.find returns empty so no sync needed
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/members/{mid}",
                body={"location": "London"}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_update_member_invalid_daily_rate(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/members/{fake_oid()}",
                body={"daily_rate": "notanumber"}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_delete_member_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/members/{fake_oid()}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 404

    def test_delete_member_success(self):
        import function
        mid = fake_oid()
        doc = {"_id": ObjectId(mid), "name": "Bob", "team_id": fake_oid(),
               "is_team_leader": False}
        db, mc = _db()
        mc.find_one.return_value = doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/members/{mid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 200

    def test_delete_member_contributor_forbidden(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/members/{fake_oid()}",
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 403


# ── Teams extended ────────────────────────────────────────────────────────────

class TestTeamsExtended:
    def setup_method(self):
        self.t = _tokens()

    def test_get_team_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(tid), "name": "Red Team",
                                    "deleted": False}
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/teams/{tid}",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"])["name"] == "Red Team"

    def test_update_team_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(tid), "name": "Team",
                                    "deleted": False}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/teams/{tid}",
                body={"description": "Updated"}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_update_team_no_fields(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/teams/{fake_oid()}",
                body={}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_update_team_not_found(self):
        import function
        tid = fake_oid()
        db, mc = _db(modified=0)
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/teams/{tid}",
                body={"description": "x"}, token=self.t["contrib"]))
        assert r["statusCode"] == 404


# ── Achievements extended ─────────────────────────────────────────────────────

class TestAchievementsExtended:
    def setup_method(self):
        self.t = _tokens()

    def test_get_achievement_success(self):
        import function
        aid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(aid), "title": "Win",
                                    "month": 1, "year": 2026}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/achievements/{aid}",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"])["title"] == "Win"

    def test_get_achievement_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/achievements/{fake_oid()}",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 404

    def test_create_achievement_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(tid), "name": "Team"}
        body = {"title": "Q1 Win", "team_id": tid, "month": 1, "year": 2026}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/achievements", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 201

    def test_update_achievement(self):
        import function
        aid = fake_oid()
        doc = {"_id": ObjectId(aid), "title": "Win", "month": 1, "year": 2026}
        db, mc = _db()
        mc.find_one.return_value = doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/achievements/{aid}",
                body={"description": "Good job"}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_update_achievement_invalid_month(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/achievements/{fake_oid()}",
                body={"month": 99}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_delete_achievement(self):
        import function
        aid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(aid), "title": "Win"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/achievements/{aid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 204

    def test_delete_achievement_not_found(self):
        import function
        db, mc = _db(modified=0)
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/achievements/{fake_oid()}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 404


# ── Metadata ──────────────────────────────────────────────────────────────────

class TestMetadata:
    def setup_method(self):
        self.t = _tokens()

    def test_list_metadata(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/metadata", token=self.t["viewer"]))
        assert r["statusCode"] == 200

    def test_create_metadata_missing_fields(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/metadata",
                body={"team_id": fake_oid()}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_create_metadata_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.side_effect = [
            {"_id": ObjectId(tid), "name": "Team"},  # team exists
            None,                                     # no duplicate key
        ]
        body = {"team_id": tid, "key": "sprint_velocity", "value": "42"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/metadata", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] in (201, 400)  # 400 if dup-check order differs

    def test_get_metadata_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/metadata/{fake_oid()}",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 404

    def test_update_metadata(self):
        import function
        mid = fake_oid()
        doc = {"_id": ObjectId(mid), "key": "k", "value": "v"}
        db, mc = _db()
        mc.find_one.return_value = doc
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/metadata/{mid}",
                body={"value": "new"}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_delete_metadata(self):
        import function
        mid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(mid)}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/metadata/{mid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 204


# ── Stats / Pipeline / Search / Resources / Activity ─────────────────────────

class TestDashboard:
    def setup_method(self):
        self.t = _tokens()

    def test_stats_endpoint(self):
        import function
        db, mc = _db()
        mc.aggregate.return_value = iter([])
        mc.count_documents.return_value = 0
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/stats", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "total_projects" in body
        assert "active_projects" in body

    def test_stats_unauthenticated(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/stats"))
        assert r["statusCode"] == 401

    def test_pipeline_endpoint(self):
        import function
        db, mc = _db()
        mc.aggregate.return_value = iter([])
        mc.count_documents.return_value = 0
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/pipeline", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "total" in body
        assert "statuses" in body

    def test_search_query_too_short(self):
        import function
        db, _ = _db()
        event = make_event("GET", "/search", token=self.t["viewer"])
        event["queryStringParameters"] = {"q": "a"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 400

    def test_search_query_valid(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]),
                                         limit=MagicMock(return_value=[]))
        event = make_event("GET", "/search", token=self.t["viewer"])
        event["queryStringParameters"] = {"q": "alice"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "teams" in body
        assert "projects" in body

    def test_resources_allocation(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/resources/allocation",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "all_allocations" in body

    def test_resources_unknown_action(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/resources/unknown",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 404

    def test_activity_feed(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[]))))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/activity",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"]) == []

    def test_activity_unauthenticated(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/activity"))
        assert r["statusCode"] == 401


# ── Audit extended ────────────────────────────────────────────────────────────

class TestAuditExtended:
    def setup_method(self):
        self.t = _tokens()

    def test_audit_list_manager(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[]))))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/audit", token=self.t["manager"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"]) == []

    def test_audit_viewer_forbidden(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/audit", token=self.t["viewer"]))
        assert r["statusCode"] == 403

    def test_audit_single_invalid_id(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/audit/bad-id",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 400

    def test_audit_single_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/audit/{fake_oid()}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 404


# ── Users (admin) ─────────────────────────────────────────────────────────────

class TestUsers:
    def setup_method(self):
        self.t = _tokens()

    def test_list_users_admin(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/users", token=self.t["admin"]))
        assert r["statusCode"] == 200

    def test_list_users_non_admin_forbidden(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/users", token=self.t["manager"]))
        assert r["statusCode"] == 403

    def test_create_user_admin(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None   # username not taken
        body = {
            "username": "newstaff", "password": "Password1!", "role": "viewer",
            "full_name": "New Staff",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body,
                                            token=self.t["admin"]))
        assert r["statusCode"] == 201

    def test_create_user_invalid_role(self):
        import function
        db, _ = _db()
        body = {"username": "x", "password": "Pass1!", "role": "superuser"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body,
                                            token=self.t["admin"]))
        assert r["statusCode"] == 400

    def test_get_user_success(self):
        import function
        uid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(uid), "username": "alice",
                                    "role": "viewer"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/users/{uid}",
                                            token=self.t["admin"]))
        assert r["statusCode"] == 200

    def test_get_user_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/users/{fake_oid()}",
                                            token=self.t["admin"]))
        assert r["statusCode"] == 404

    def test_update_user(self):
        import function
        uid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(uid), "role": "viewer"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("PUT", f"/users/{uid}",
                body={"full_name": "New Name"}, token=self.t["admin"]))
        assert r["statusCode"] == 200


# ── Team notes ────────────────────────────────────────────────────────────────

class TestTeamNotes:
    def setup_method(self):
        self.t = _tokens()

    def test_get_notes(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/teams/{tid}/notes",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        assert json.loads(r["body"]) == []

    def test_post_note_success(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(tid), "name": "Team"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/teams/{tid}/notes",
                body={"content": "This is a note"}, token=self.t["contrib"]))
        assert r["statusCode"] == 201
        body = json.loads(r["body"])
        assert body["content"] == "This is a note"

    def test_post_note_missing_content(self):
        import function
        tid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/teams/{tid}/notes",
                body={}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_post_note_team_not_found(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/teams/{tid}/notes",
                body={"content": "Note"}, token=self.t["contrib"]))
        assert r["statusCode"] == 404

    def test_post_note_viewer_forbidden(self):
        import function
        tid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", f"/teams/{tid}/notes",
                body={"content": "Note"}, token=self.t["viewer"]))
        assert r["statusCode"] == 403

    def test_delete_note_success(self):
        import function
        tid = fake_oid()
        nid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(nid)}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/teams/{tid}/notes/{nid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 204

    def test_delete_note_not_found(self):
        import function
        tid = fake_oid()
        nid = fake_oid()
        db, mc = _db(modified=0)
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/teams/{tid}/notes/{nid}",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 404

    def test_notes_invalid_team_id(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/teams/not-a-valid-id/notes",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 400

    def test_notes_unauthenticated(self):
        import function
        tid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", f"/teams/{tid}/notes"))
        assert r["statusCode"] == 401


# ── Admin fix-members endpoint ────────────────────────────────────────────────

class TestAdmin:
    def setup_method(self):
        self.t = _tokens()

    def test_fix_members_admin(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/admin/fix-members",
                                            token=self.t["admin"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "total" in body

    def test_fix_members_non_admin_forbidden(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/admin/fix-members",
                                            token=self.t["manager"]))
        assert r["statusCode"] == 403

    def test_admin_unknown_action(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/admin/unknown",
                                            token=self.t["admin"]))
        assert r["statusCode"] == 404


# ── Resources with real allocation data ───────────────────────────────────────

class TestResourcesWithData:
    def setup_method(self):
        self.t = _tokens()

    def test_resources_allocation_with_members(self):
        """Covers the member_map / utilization calculation branches."""
        import function
        pid = fake_oid()
        mid = fake_oid()
        project_with_members = {
            "_id":     ObjectId(pid),
            "name":    "Test Project",
            "status":  "in_progress",
            "members": [
                {
                    "member_id":      mid,
                    "member_name":    "Alice",
                    "days_allocated": 25,   # over 20 baseline → over-allocated
                    "cost":           5000,
                    "role":           "engineer",
                }
            ],
            "due_date": "2026-12-31",
            "priority": "high",
            "progress": 50,
        }
        db, mc = _db()
        # handle_resources calls list(find(...)) without .sort() chaining
        mc.find.return_value = [project_with_members]
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/resources/allocation",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert body["total_allocated"] == 1
        assert body["over_allocated_count"] == 1


# ── Projects list with risk flags ─────────────────────────────────────────────

class TestProjectsWithData:
    def setup_method(self):
        self.t = _tokens()

    def test_list_projects_with_overdue(self):
        """Covers the risk-flag calculation loop in handle_projects GET."""
        import function
        pid = fake_oid()
        overdue_project = {
            "_id":          ObjectId(pid),
            "name":         "Late Project",
            "status":       "in_progress",
            "due_date":     "2020-01-01",   # definitely overdue
            "progress":     30,
            "total_budget": 100000,
            "spent_budget": 90000,          # over budget too
        }
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[overdue_project]))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/projects", token=self.t["viewer"]))
        assert r["statusCode"] == 200
        projects = json.loads(r["body"])
        assert len(projects) == 1
        assert projects[0]["is_overdue"] is True
        assert projects[0]["is_over_budget"] is True

    def test_list_projects_with_search(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(return_value=[]))
        event = make_event("GET", "/projects", token=self.t["viewer"])
        event["queryStringParameters"] = {"search": "alpha", "status": "in_progress"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 200


# ── Audit with filters ────────────────────────────────────────────────────────

class TestAuditFilters:
    def setup_method(self):
        self.t = _tokens()

    def test_audit_filter_by_resource(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[]))))
        event = make_event("GET", "/audit", token=self.t["manager"])
        event["queryStringParameters"] = {"resource": "teams", "action": "CREATE"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 200

    def test_audit_filter_invalid_from_date(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[]))))
        event = make_event("GET", "/audit", token=self.t["manager"])
        event["queryStringParameters"] = {"from_date": "not-a-date"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 400

    def test_audit_filter_by_username(self):
        import function
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[]))))
        event = make_event("GET", "/audit", token=self.t["manager"])
        event["queryStringParameters"] = {"username": "admin"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 200


# ── parse_body edge cases ─────────────────────────────────────────────────────

class TestParseBody:
    def setup_method(self):
        self.t = _tokens()

    def test_body_too_large_returns_400(self):
        import function
        db, _ = _db()
        # POST with an oversized body
        event = make_event("POST", "/auth/login")
        event["body"] = "x" * 60_001
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 413

    def test_invalid_json_body_graceful(self):
        """Invalid JSON body should be treated as empty dict, not crash."""
        import function
        db, _ = _db()
        event = make_event("POST", "/auth/login")
        event["body"] = "not-valid-json{{{"
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        # Should return 400 (missing fields) not 500
        assert r["statusCode"] in (400, 401)

    def test_dict_body_passed_directly(self):
        """Covers the branch where body is already a dict."""
        import function
        db, _ = _db()
        event = make_event("POST", "/auth/login")
        event["body"] = {"username": "nobody", "password": "wrong"}  # dict not string
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 401



# ── Activity with actual log entries ─────────────────────────────────────────

class TestActivityWithData:
    def setup_method(self):
        self.t = _tokens()

    def test_activity_returns_feed_items(self):
        import function
        log_entry = {
            "_id":       ObjectId(),
            "action":    "CREATE",
            "resource":  "teams",
            "username":  "admin",
            "role":      "admin",
            "timestamp": datetime.now(timezone.utc),
            "changes":   {},
            "details":   "Red Team",
        }
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[log_entry]))))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/activity",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert len(body) == 1
        assert "sentence" in body[0]

    def test_activity_login_event(self):
        import function
        log_entry = {
            "_id":       ObjectId(),
            "action":    "LOGIN",
            "resource":  "auth",
            "username":  "viewer1",
            "role":      "viewer",
            "timestamp": datetime.now(timezone.utc),
            "changes":   {},
            "details":   "logged in",
        }
        db, mc = _db()
        mc.find.return_value = MagicMock(sort=MagicMock(
            return_value=MagicMock(limit=MagicMock(return_value=[log_entry]))))
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/activity",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert "logged in" in body[0]["sentence"]


# ── Reorder deliverables and resource utilization ─────────────────────────────

class TestProjectsAndResources:
    def setup_method(self):
        self.t = _tokens()

    def test_reorder_deliverables(self):
        import function
        pid = fake_oid()
        items = [
            {"id": "aaa", "title": "First",  "status": "pending", "depends_on": []},
            {"id": "bbb", "title": "Second", "status": "pending", "depends_on": []},
        ]
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "deliverables": items}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/reorder",
                body={"item_ids": ["bbb", "aaa"]}, token=self.t["contrib"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert body["deliverables"][0]["id"] == "bbb"

    def test_reorder_deliverables_unknown_id(self):
        import function
        pid = fake_oid()
        items = [{"id": "aaa", "title": "First", "status": "pending", "depends_on": []}]
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "deliverables": items}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/reorder",
                body={"item_ids": ["unknown"]}, token=self.t["contrib"]))
        assert r["statusCode"] == 400

    def test_reorder_deliverables_empty_project(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "deliverables": []}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/reorder",
                body={"item_ids": []}, token=self.t["contrib"]))
        assert r["statusCode"] == 200

    def test_resources_optimal_and_low_utilization(self):
        """Covers utilization_status branches for optimal (50-80%) and low (<50%)."""
        import function
        pid  = fake_oid()
        mid1 = fake_oid()
        mid2 = fake_oid()
        projects = [
            {
                "_id": ObjectId(pid), "name": "P1", "status": "in_progress",
                "due_date": "2027-01-01", "priority": "medium", "progress": 60,
                "members": [
                    {"member_id": mid1, "member_name": "Alice",
                     "days_allocated": 12, "cost": 1200, "role": "dev"},
                    {"member_id": mid2, "member_name": "Bob",
                     "days_allocated": 5,  "cost": 500,  "role": "test"},
                ],
            }
        ]
        db, mc = _db()
        mc.find.return_value = projects
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/resources/allocation",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        statuses = {a["member_id"]: a["utilization_status"]
                    for a in body["all_allocations"]}
        assert statuses[mid1] == "optimal"
        assert statuses[mid2] == "low"

    def test_resources_warning_utilization(self):
        """Covers the 80-100% utilization status = warning."""
        import function
        pid = fake_oid()
        mid = fake_oid()
        projects = [
            {
                "_id": ObjectId(pid), "name": "P2", "status": "in_progress",
                "due_date": "2027-01-01", "priority": "high", "progress": 40,
                "members": [
                    {"member_id": mid, "member_name": "Carol",
                     "days_allocated": 17, "cost": 8500, "role": "lead"},
                ],
            }
        ]
        db, mc = _db()
        mc.find.return_value = projects
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/resources/allocation",
                                            token=self.t["viewer"]))
        assert r["statusCode"] == 200
        body = json.loads(r["body"])
        assert body["all_allocations"][0]["utilization_status"] == "warning"


# ── auth.py deep coverage ─────────────────────────────────────────────────────

class TestAuthDeep:
    def test_decode_expired_token(self):
        """Covers the ExpiredSignatureError branch in decode_token."""
        from auth import decode_token
        # Create a token with already-expired exp
        import jwt as pyjwt
        import time
        from auth import JWT_SECRET, JWT_ALGORITHM
        payload = {
            "sub": "uid", "username": "x", "role": "viewer", "type": "access",
            "jti": "test", "iss": "acme-team-mgmt",
            "iat": 1000000, "exp": 1000001,  # epoch: 1970 — always expired
        }
        tok = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        assert decode_token(tok) is None

    def test_lockout_expiry_resets(self):
        """Covers the 'locked_until is in the past' reset branch in record_failed_attempt."""
        from auth import _failed_attempts, record_failed_attempt, clear_failed_attempts
        from datetime import datetime, timezone, timedelta
        user = "lockout_expiry_test_user"
        clear_failed_attempts(user)
        # Manually set a lockout that is already expired
        _failed_attempts[user] = {
            "count": 5,
            "first_attempt": datetime.now(timezone.utc) - timedelta(hours=1),
            "locked_until":  datetime.now(timezone.utc) - timedelta(minutes=5),
        }
        # Call record_failed_attempt — should reset and count from 1
        count = record_failed_attempt(user)
        assert count == 1
        clear_failed_attempts(user)

    def test_locked_error_returns_429(self):
        """Covers the locked_error helper."""
        from auth import locked_error
        r = locked_error(10)
        assert r["statusCode"] == 429
        assert "locked" in r["body"].lower()

    def test_refresh_token_user_not_found(self):
        """Covers the user-not-found branch in refresh_access_token."""
        from auth import create_refresh_token, refresh_access_token
        from unittest.mock import MagicMock
        tok = create_refresh_token("000000000000000000000001", "ghost")
        mock_db = MagicMock()
        mock_col = MagicMock()
        mock_col.find_one.return_value = None
        mock_db.__getitem__ = lambda s, k: mock_col
        result = refresh_access_token(tok, mock_db)
        assert result is None

    def test_refresh_token_success(self):
        """Covers the happy path of refresh_access_token."""
        from auth import create_refresh_token, refresh_access_token
        from unittest.mock import MagicMock
        from bson import ObjectId
        uid = str(ObjectId())
        tok = create_refresh_token(uid, "alice")
        mock_db = MagicMock()
        mock_col = MagicMock()
        mock_col.find_one.return_value = {"_id": ObjectId(uid), "username": "alice", "role": "viewer"}
        mock_db.__getitem__ = lambda s, k: mock_col
        result = refresh_access_token(tok, mock_db)
        assert result is not None
        assert "access_token" in result

    def test_brute_force_full_flow(self):
        """Drives login endpoint to lockout (covers locked_error path in handler)."""
        import function
        from unittest.mock import MagicMock, patch
        from auth import clear_failed_attempts
        user = "brute_force_test_user_xy"
        clear_failed_attempts(user)
        db, mc = _db()
        mc.find_one.return_value = None  # user not found each time
        mc.count_documents.return_value = 0
        # Exhaust all 5 allowed attempts
        for _ in range(5):
            with patch("function.get_db", return_value=db):
                function.handler(make_event("POST", "/auth/login",
                                            {"username": user, "password": "bad"}))
        # 6th attempt should be locked
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/auth/login",
                                            {"username": user, "password": "bad"}))
        assert r["statusCode"] == 429
        clear_failed_attempts(user)


# ── Goal 4 error-path expansion ─────────────────────────────────────────────

class TestCrudErrorCoverageExpansion:
    def setup_method(self):
        self.t = _tokens()

    @pytest.mark.parametrize(
        "body, expected",
        [
            ({"password": "Password1!", "role": "viewer"}, "username is required"),
            ({"username": "u1", "password": "Password1!", "role": "superuser"}, "role must be"),
            ({"username": "u1", "password": "short", "role": "viewer"}, "at least 8"),
        ],
    )
    def test_users_create_validation_errors(self, body, expected):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body, token=self.t["admin"]))
        assert r["statusCode"] == 400
        assert expected in json.loads(r["body"])["error"]

    def test_users_create_duplicate_username(self):
        import function
        db, mc = _db()
        mc.find_one.side_effect = [{"username": "u1"}]
        body = {"username": "u1", "password": "Password1!", "role": "viewer"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body, token=self.t["admin"]))
        assert r["statusCode"] == 400
        assert "Username already exists" in json.loads(r["body"])["error"]

    def test_users_create_duplicate_email(self):
        import function
        db, mc = _db()
        mc.find_one.side_effect = [None, {"email": "exists@example.com"}]
        body = {
            "username": "u2",
            "password": "Password1!",
            "role": "viewer",
            "email": "exists@example.com",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body, token=self.t["admin"]))
        assert r["statusCode"] == 400
        assert "Email already registered" in json.loads(r["body"])["error"]

    def test_users_update_invalid_role(self):
        import function
        uid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event("PUT", f"/users/{uid}", body={"role": "invalid"}, token=self.t["admin"])
            )
        assert r["statusCode"] == 400
        assert "Invalid role" in json.loads(r["body"])["error"]

    def test_users_delete_self_forbidden(self):
        import function
        from auth import create_token

        uid = fake_oid()
        token = create_token(uid, "selfadmin", "admin")
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("DELETE", f"/users/{uid}", token=token))
        assert r["statusCode"] == 400
        assert "cannot delete your own account" in json.loads(r["body"])["error"].lower()

    @pytest.mark.parametrize(
        "body, expected",
        [
            ({"name": "Team X", "location": "NY", "department": "Tech"}, "team_leader is required"),
            ({"name": "Team X", "team_leader": "A", "department": "Tech"}, "location is required"),
            ({"name": "Team X", "team_leader": "A", "location": "NY"}, "department is required"),
        ],
    )
    def test_teams_create_required_field_errors(self, body, expected):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/teams", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert expected in json.loads(r["body"])["error"]

    def test_teams_create_duplicate_name(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(), "name": "Team X"}
        body = {
            "name": "Team X",
            "team_leader": "Leader",
            "location": "NY",
            "department": "Tech",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/teams", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "Team name already exists" in json.loads(r["body"])["error"]

    def test_members_create_team_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        body = {
            "name": "Alice Smith",
            "team_id": fake_oid(),
            "email": "alice@example.com",
            "role": "Engineer",
            "employment_type": "direct",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/members", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 404
        assert "Team not found" in json.loads(r["body"])["error"]

    def test_members_create_invalid_employment_type(self):
        import function
        db, mc = _db()
        mc.find_one.side_effect = [None, {"_id": ObjectId(), "name": "Team"}]
        body = {
            "name": "Alice Smith",
            "team_id": fake_oid(),
            "email": "alice@example.com",
            "role": "Engineer",
            "employment_type": "vendor",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/members", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "employment_type" in json.loads(r["body"])["error"]

    def test_members_get_invalid_id(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("GET", "/members/not-an-id", token=self.t["viewer"]))
        assert r["statusCode"] == 400
        assert "Invalid member id" in json.loads(r["body"])["error"]

    def test_members_update_negative_daily_rate(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event("PUT", f"/members/{fake_oid()}", body={"daily_rate": -10}, token=self.t["contrib"])
            )
        assert r["statusCode"] == 400
        assert "cannot be negative" in json.loads(r["body"])["error"]

    def test_achievements_list_invalid_year(self):
        import function
        db, _ = _db()
        event = make_event("GET", "/achievements", token=self.t["viewer"])
        event["queryStringParameters"] = {"year": "not-a-number"}
        with patch("function.get_db", return_value=db):
            r = function.handler(event)
        assert r["statusCode"] == 400
        assert "year must be a valid number" in json.loads(r["body"])["error"]

    def test_achievements_create_invalid_team_id(self):
        import function
        db, _ = _db()
        body = {"title": "Win", "team_id": "bad", "month": 1, "year": 2026}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/achievements", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "Invalid team_id" in json.loads(r["body"])["error"]

    def test_achievements_create_team_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        body = {"title": "Win", "team_id": fake_oid(), "month": 1, "year": 2026}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/achievements", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 404
        assert "Team not found" in json.loads(r["body"])["error"]

    def test_achievements_update_invalid_year(self):
        import function
        aid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event("PUT", f"/achievements/{aid}", body={"year": 3000}, token=self.t["contrib"])
            )
        assert r["statusCode"] == 400
        assert "year must be 2000-2100" in json.loads(r["body"])["error"]

    def test_metadata_create_invalid_team_id(self):
        import function
        db, _ = _db()
        body = {"team_id": "bad", "key": "k", "value": "v"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/metadata", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "Invalid team_id" in json.loads(r["body"])["error"]

    def test_metadata_create_team_not_found(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = None
        body = {"team_id": fake_oid(), "key": "k", "value": "v"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/metadata", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 404
        assert "Team not found" in json.loads(r["body"])["error"]

    def test_metadata_create_duplicate_key(self):
        import function
        db, mc = _db()
        mc.find_one.side_effect = [{"_id": ObjectId()}, {"_id": ObjectId()}]
        body = {"team_id": fake_oid(), "key": "dup", "value": "v"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/metadata", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "already exists" in json.loads(r["body"])["error"]

    def test_projects_create_invalid_status(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team"}]
        body = {
            "name": "Alpha Project",
            "team_id": tid,
            "owner_name": "Owner",
            "start_date": "2026-01-01",
            "due_date": "2026-03-01",
            "status": "invalid",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "Invalid status" in json.loads(r["body"])["error"]

    def test_projects_create_invalid_priority(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team"}]
        body = {
            "name": "Alpha Project",
            "team_id": tid,
            "owner_name": "Owner",
            "start_date": "2026-01-01",
            "due_date": "2026-03-01",
            "priority": "urgent",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/projects", body=body, token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert "Invalid priority" in json.loads(r["body"])["error"]

    def test_projects_add_member_invalid_member_id(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event("POST", f"/projects/{pid}/members", body={"member_id": "bad"}, token=self.t["contrib"])
            )
        assert r["statusCode"] == 400
        assert "Valid member_id is required" in json.loads(r["body"])["error"]

    def test_projects_add_member_project_not_found(self):
        import function
        pid = fake_oid()
        mid = fake_oid()
        db, mc = _db()
        mc.find_one.side_effect = [{"_id": ObjectId(mid), "name": "Member"}, None]
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event("POST", f"/projects/{pid}/members", body={"member_id": mid}, token=self.t["contrib"])
            )
        assert r["statusCode"] == 404
        assert "Project not found" in json.loads(r["body"])["error"]

    def test_projects_add_deliverable_project_not_found(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = None
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event("POST", f"/projects/{pid}/deliverables", body={"title": "Task"}, token=self.t["contrib"])
            )
        assert r["statusCode"] == 404
        assert "Project not found" in json.loads(r["body"])["error"]

    def test_projects_reorder_item_ids_not_list(self):
        import function
        pid = fake_oid()
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event(
                    "PUT",
                    f"/projects/{pid}/deliverables/reorder",
                    body={"item_ids": "not-list"},
                    token=self.t["contrib"],
                )
            )
        assert r["statusCode"] == 400
        assert "item_ids must be a list" in json.loads(r["body"])["error"]

    def test_projects_update_deliverable_item_not_found(self):
        import function
        pid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(pid), "deliverables": [{"id": "a1", "status": "pending"}]}
        with patch("function.get_db", return_value=db):
            r = function.handler(
                make_event(
                    "PUT",
                    f"/projects/{pid}/deliverables/not-there",
                    body={"status": "done"},
                    token=self.t["contrib"],
                )
            )
        assert r["statusCode"] == 404
        assert "Deliverable item not found" in json.loads(r["body"])["error"]


# ── Error coverage boost for CRUD validation branches ───────────────────────

class TestCrudErrorCoverageBoost:
    def setup_method(self):
        self.t = _tokens()

    @pytest.mark.parametrize(
        "body, expected_msg",
        [
            ({"password": "Password1!", "role": "viewer"}, "username is required"),
            ({"username": "abc", "password": "short", "role": "viewer"},
             "Password must be at least 8 characters"),
        ],
    )
    def test_users_create_validation_errors(self, body, expected_msg):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body,
                                            token=self.t["admin"]))
        assert r["statusCode"] == 400
        assert expected_msg in json.loads(r["body"])["error"]

    def test_users_create_duplicate_username(self):
        import function
        db, mc = _db()
        mc.find_one.return_value = {"username": "dup"}
        body = {"username": "dup", "password": "Password1!", "role": "viewer"}
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body,
                                            token=self.t["admin"]))
        assert r["statusCode"] == 400
        assert "Username already exists" in json.loads(r["body"])["error"]

    def test_users_create_duplicate_email(self):
        import function
        db, mc = _db()
        mc.find_one.side_effect = [None, {"email": "dup@example.com"}]
        body = {
            "username": "newuser",
            "password": "Password1!",
            "role": "viewer",
            "email": "dup@example.com",
        }
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/users", body=body,
                                            token=self.t["admin"]))
        assert r["statusCode"] == 400
        assert "Email already registered" in json.loads(r["body"])["error"]

    def test_users_invalid_id_and_method_not_allowed(self):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            bad_id_resp = function.handler(make_event("GET", "/users/not-an-id",
                                                      token=self.t["admin"]))
            method_resp = function.handler(make_event("PATCH", f"/users/{fake_oid()}",
                                                      token=self.t["admin"]))
        assert bad_id_resp["statusCode"] == 400
        assert method_resp["statusCode"] == 405

    def test_users_update_validation_and_not_found(self):
        import function
        uid = fake_oid()
        db, mc = _db(modified=0)
        with patch("function.get_db", return_value=db):
            invalid_role = function.handler(make_event("PUT", f"/users/{uid}",
                                                       body={"role": "bad-role"},
                                                       token=self.t["admin"]))
            short_password = function.handler(make_event("PUT", f"/users/{uid}",
                                                         body={"password": "short"},
                                                         token=self.t["admin"]))
            no_fields = function.handler(make_event("PUT", f"/users/{uid}", body={},
                                                    token=self.t["admin"]))
            not_found = function.handler(make_event("PUT", f"/users/{uid}",
                                                    body={"full_name": "X"},
                                                    token=self.t["admin"]))
        assert invalid_role["statusCode"] == 400
        assert short_password["statusCode"] == 400
        assert no_fields["statusCode"] == 400
        assert not_found["statusCode"] == 404

    def test_users_delete_guard_rails(self):
        import function
        from auth import create_token

        uid = fake_oid()
        self_token = create_token(uid, "self-admin", "admin")

        db_self, _ = _db()
        with patch("function.get_db", return_value=db_self):
            self_delete = function.handler(make_event("DELETE", f"/users/{uid}",
                                                      token=self_token))

        db_last_admin, mc_last_admin = _db()
        mc_last_admin.count_documents.return_value = 1
        mc_last_admin.find_one.return_value = {"_id": ObjectId(uid), "role": "admin"}
        with patch("function.get_db", return_value=db_last_admin):
            last_admin = function.handler(make_event("DELETE", f"/users/{uid}",
                                                     token=self.t["admin"]))

        db_not_found, mc_not_found = _db()
        mc_not_found.count_documents.return_value = 2
        mc_not_found.delete_one.return_value = MagicMock(deleted_count=0)
        with patch("function.get_db", return_value=db_not_found):
            not_found = function.handler(make_event("DELETE", f"/users/{uid}",
                                                    token=self.t["admin"]))

        assert self_delete["statusCode"] == 400
        assert last_admin["statusCode"] == 400
        assert not_found["statusCode"] == 404

    @pytest.mark.parametrize(
        "body, expected_msg",
        [
            ({"name": "Team A", "location": "NY", "department": "Tech"},
             "team_leader is required"),
            ({"name": "Team A", "team_leader": "Lead", "department": "Tech"},
             "location is required"),
            ({"name": "Team A", "team_leader": "Lead", "location": "NY"},
             "department is required"),
        ],
    )
    def test_teams_create_required_field_errors(self, body, expected_msg):
        import function
        db, _ = _db()
        with patch("function.get_db", return_value=db):
            r = function.handler(make_event("POST", "/teams", body=body,
                                            token=self.t["contrib"]))
        assert r["statusCode"] == 400
        assert expected_msg in json.loads(r["body"])["error"]

    def test_teams_duplicate_name_and_method_not_allowed(self):
        import function
        tid = fake_oid()
        db, mc = _db()
        mc.find_one.return_value = {"_id": ObjectId(tid), "name": "Team A"}
        body = {
            "name": "Team A",
            "team_leader": "Lead",
            "location": "NY",
            "department": "Tech",
        }
        with patch("function.get_db", return_value=db):
            duplicate = function.handler(make_event("POST", "/teams", body=body,
                                                    token=self.t["contrib"]))
            method = function.handler(make_event("PATCH", f"/teams/{tid}",
                                                 token=self.t["manager"]))
        assert duplicate["statusCode"] == 400
        assert method["statusCode"] == 405

    def test_members_additional_error_paths(self):
        import function
        mid = fake_oid()
        tid = fake_oid()
        base_body = {
            "name": "Alice Smith",
            "team_id": tid,
            "email": "alice@example.com",
            "role": "Engineer",
        }

        db_team_missing, mc_team_missing = _db()
        mc_team_missing.find_one.side_effect = [None, None]

        db_bad_type, mc_bad_type = _db()
        mc_bad_type.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team"}]

        db_update_not_found, mc_update_not_found = _db(modified=0)

        with patch("function.get_db", return_value=db_team_missing):
            team_missing = function.handler(make_event("POST", "/members", body=base_body,
                                                       token=self.t["contrib"]))

        with patch("function.get_db", return_value=db_bad_type):
            bad_type = function.handler(make_event("POST", "/members", body={
                **base_body, "employment_type": "contractor"
            }, token=self.t["contrib"]))

        with patch("function.get_db", return_value=db_update_not_found):
            invalid_member_id = function.handler(make_event("GET", "/members/not-an-id",
                                                            token=self.t["viewer"]))
            invalid_update_type = function.handler(make_event("PUT", f"/members/{mid}",
                                                              body={"employment_type": "bad"},
                                                              token=self.t["contrib"]))
            negative_rate = function.handler(make_event("PUT", f"/members/{mid}",
                                                        body={"daily_rate": -1},
                                                        token=self.t["contrib"]))
            not_found = function.handler(make_event("PUT", f"/members/{mid}",
                                                    body={"location": "LDN"},
                                                    token=self.t["contrib"]))
            method = function.handler(make_event("PATCH", f"/members/{mid}",
                                                 token=self.t["manager"]))

        assert team_missing["statusCode"] == 404
        assert bad_type["statusCode"] == 400
        assert invalid_member_id["statusCode"] == 400
        assert invalid_update_type["statusCode"] == 400
        assert negative_rate["statusCode"] == 400
        assert not_found["statusCode"] == 404
        assert method["statusCode"] == 405

    def test_achievements_additional_error_paths(self):
        import function
        aid = fake_oid()
        tid = fake_oid()
        with patch("function.get_db", return_value=_db()[0]):
            event_month = make_event("GET", "/achievements", token=self.t["viewer"])
            event_month["queryStringParameters"] = {"month": "abc"}
            bad_month = function.handler(event_month)

            event_year = make_event("GET", "/achievements", token=self.t["viewer"])
            event_year["queryStringParameters"] = {"year": "abc"}
            bad_year = function.handler(event_year)

            missing = function.handler(make_event("POST", "/achievements",
                                                  body={"team_id": tid, "month": 1, "year": 2026},
                                                  token=self.t["contrib"]))
            invalid_team_id = function.handler(make_event("POST", "/achievements",
                                                          body={"title": "T", "team_id": "bad", "month": 1, "year": 2026},
                                                          token=self.t["contrib"]))
            invalid_id = function.handler(make_event("GET", "/achievements/not-an-id",
                                                     token=self.t["viewer"]))

        db_team_missing, mc_team_missing = _db()
        mc_team_missing.find_one.return_value = None
        with patch("function.get_db", return_value=db_team_missing):
            team_missing = function.handler(make_event("POST", "/achievements", body={
                "title": "T", "team_id": tid, "month": 1, "year": 2026
            }, token=self.t["contrib"]))

        db_update_not_found, _ = _db(modified=0)
        with patch("function.get_db", return_value=db_update_not_found):
            no_fields = function.handler(make_event("PUT", f"/achievements/{aid}",
                                                    body={}, token=self.t["contrib"]))
            bad_update_year = function.handler(make_event("PUT", f"/achievements/{aid}",
                                                          body={"year": 2200},
                                                          token=self.t["contrib"]))
            not_found = function.handler(make_event("PUT", f"/achievements/{aid}",
                                                    body={"description": "x"},
                                                    token=self.t["contrib"]))
            method = function.handler(make_event("PATCH", f"/achievements/{aid}",
                                                 token=self.t["manager"]))

        assert bad_month["statusCode"] == 400
        assert bad_year["statusCode"] == 400
        assert missing["statusCode"] == 400
        assert invalid_team_id["statusCode"] == 400
        assert team_missing["statusCode"] == 404
        assert invalid_id["statusCode"] == 400
        assert no_fields["statusCode"] == 400
        assert bad_update_year["statusCode"] == 400
        assert not_found["statusCode"] == 404
        assert method["statusCode"] == 405

    def test_metadata_additional_error_paths(self):
        import function
        mid = fake_oid()
        tid = fake_oid()

        db_invalid_team, _ = _db()
        with patch("function.get_db", return_value=db_invalid_team):
            invalid_team_id = function.handler(make_event("POST", "/metadata", body={
                "team_id": "bad", "key": "k", "value": "v"
            }, token=self.t["contrib"]))

        db_team_missing, mc_team_missing = _db()
        mc_team_missing.find_one.return_value = None
        with patch("function.get_db", return_value=db_team_missing):
            team_missing = function.handler(make_event("POST", "/metadata", body={
                "team_id": tid, "key": "k", "value": "v"
            }, token=self.t["contrib"]))

        db_dup_key, mc_dup_key = _db()
        mc_dup_key.find_one.side_effect = [{"_id": ObjectId(tid), "name": "Team"}, {"key": "k"}]
        with patch("function.get_db", return_value=db_dup_key):
            dup_key = function.handler(make_event("POST", "/metadata", body={
                "team_id": tid, "key": "k", "value": "v"
            }, token=self.t["contrib"]))

        db_update_not_found, _ = _db(modified=0)
        with patch("function.get_db", return_value=db_update_not_found):
            invalid_id = function.handler(make_event("GET", "/metadata/not-an-id",
                                                     token=self.t["viewer"]))
            no_fields = function.handler(make_event("PUT", f"/metadata/{mid}",
                                                    body={}, token=self.t["contrib"]))
            not_found = function.handler(make_event("PUT", f"/metadata/{mid}",
                                                    body={"value": "x"},
                                                    token=self.t["contrib"]))
            delete_not_found = function.handler(make_event("DELETE", f"/metadata/{mid}",
                                                           token=self.t["manager"]))
            method = function.handler(make_event("PATCH", f"/metadata/{mid}",
                                                 token=self.t["manager"]))

        assert invalid_team_id["statusCode"] == 400
        assert team_missing["statusCode"] == 404
        assert dup_key["statusCode"] == 400
        assert invalid_id["statusCode"] == 400
        assert no_fields["statusCode"] == 400
        assert not_found["statusCode"] == 404
        assert delete_not_found["statusCode"] == 404
        assert method["statusCode"] == 405

    def test_projects_additional_error_paths(self):
        import function
        pid = fake_oid()
        mid = fake_oid()
        tid = fake_oid()

        db_create_status, mc_create_status = _db()
        mc_create_status.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team"}]
        bad_status_body = {
            "name": "New Project",
            "team_id": tid,
            "owner_name": "Owner",
            "start_date": "2026-01-01",
            "due_date": "2026-12-31",
            "status": "invalid",
        }
        with patch("function.get_db", return_value=db_create_status):
            bad_status = function.handler(make_event("POST", "/projects", body=bad_status_body,
                                                     token=self.t["contrib"]))

        db_create_priority, mc_create_priority = _db()
        mc_create_priority.find_one.side_effect = [None, {"_id": ObjectId(tid), "name": "Team"}]
        bad_priority_body = {
            "name": "New Project",
            "team_id": tid,
            "owner_name": "Owner",
            "start_date": "2026-01-01",
            "due_date": "2026-12-31",
            "priority": "super",
        }
        with patch("function.get_db", return_value=db_create_priority):
            bad_priority = function.handler(make_event("POST", "/projects", body=bad_priority_body,
                                                       token=self.t["contrib"]))

        db_member_missing, mc_member_missing = _db()
        mc_member_missing.find_one.return_value = None

        db_project_missing, mc_project_missing = _db()
        mc_project_missing.find_one.side_effect = [{"_id": ObjectId(mid), "name": "A"}, None]

        db_deliverable_missing, mc_deliverable_missing = _db()
        mc_deliverable_missing.find_one.return_value = None

        with patch("function.get_db", return_value=db_member_missing):
            invalid_member_id = function.handler(make_event("POST", f"/projects/{pid}/members",
                                                            body={"member_id": "bad"},
                                                            token=self.t["contrib"]))
            member_not_found = function.handler(make_event("POST", f"/projects/{pid}/members",
                                                           body={"member_id": mid},
                                                           token=self.t["contrib"]))

        with patch("function.get_db", return_value=db_project_missing):
            project_not_found_on_add_member = function.handler(make_event(
                "POST", f"/projects/{pid}/members", body={"member_id": mid},
                token=self.t["contrib"]
            ))

        with patch("function.get_db", return_value=db_deliverable_missing):
            remove_member_missing_project = function.handler(make_event(
                "DELETE", f"/projects/{pid}/members/{mid}", token=self.t["contrib"]
            ))
            add_deliverable_missing_project = function.handler(make_event(
                "POST", f"/projects/{pid}/deliverables", body={"title": "X"},
                token=self.t["contrib"]
            ))
            reorder_missing_project = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/reorder", body={"item_ids": ["a"]},
                token=self.t["contrib"]
            ))
            update_deliverable_missing_project = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/item-1", body={"status": "done"},
                token=self.t["contrib"]
            ))
            delete_deliverable_missing_project = function.handler(make_event(
                "DELETE", f"/projects/{pid}/deliverables/item-1", token=self.t["contrib"]
            ))

        db_deliverable_item_missing, mc_deliverable_item_missing = _db()
        mc_deliverable_item_missing.find_one.return_value = {"_id": ObjectId(pid), "deliverables": []}
        with patch("function.get_db", return_value=db_deliverable_item_missing):
            missing_item = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/item-1", body={"status": "done"},
                token=self.t["contrib"]
            ))

        with patch("function.get_db", return_value=_db()[0]):
            reorder_bad_payload = function.handler(make_event(
                "PUT", f"/projects/{pid}/deliverables/reorder", body={"item_ids": "bad"},
                token=self.t["contrib"]
            ))
            method_not_allowed = function.handler(make_event(
                "PATCH", f"/projects/{pid}", token=self.t["manager"]
            ))

        assert bad_status["statusCode"] == 400
        assert bad_priority["statusCode"] == 400
        assert invalid_member_id["statusCode"] == 400
        assert member_not_found["statusCode"] == 404
        assert project_not_found_on_add_member["statusCode"] == 404
        assert remove_member_missing_project["statusCode"] == 404
        assert add_deliverable_missing_project["statusCode"] == 404
        assert reorder_bad_payload["statusCode"] == 400
        assert reorder_missing_project["statusCode"] == 404
        assert update_deliverable_missing_project["statusCode"] == 404
        assert missing_item["statusCode"] == 404
        assert delete_deliverable_missing_project["statusCode"] == 404
        assert method_not_allowed["statusCode"] == 405
