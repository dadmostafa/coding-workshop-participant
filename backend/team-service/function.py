"""
ACME Inc. Team Management – Lambda handler.

Routes (all under /api/team-service):

  POST   /auth/login                   public
  POST   /auth/seed                    public (seeds default admin on first run)

  GET    /users                        admin
  POST   /users                        admin
  PUT    /users/{id}                   admin
  DELETE /users/{id}                   admin

  GET    /teams                        viewer+
  POST   /teams                        contributor+
  GET    /teams/{id}                   viewer+
  PUT    /teams/{id}                   contributor+
  DELETE /teams/{id}                   manager+

  GET    /members                      viewer+  (?team_id= filter)
  POST   /members                      contributor+
  GET    /members/{id}                 viewer+
  PUT    /members/{id}                 contributor+
  DELETE /members/{id}                 manager+

  GET    /achievements                 viewer+  (?team_id= ?month= ?year= filter)
  POST   /achievements                 contributor+
  GET    /achievements/{id}            viewer+
  PUT    /achievements/{id}            contributor+
  DELETE /achievements/{id}            manager+

  GET    /metadata                     viewer+  (?team_id= filter)
  POST   /metadata                     contributor+
  GET    /metadata/{id}                viewer+
  PUT    /metadata/{id}                contributor+
  DELETE /metadata/{id}                manager+

  GET    /stats                        viewer+  (dashboard aggregations)
"""

import json
import logging
import re
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone

from mongo_service import get_db, reset_client
from auth import (
    get_current_user, create_token, create_access_token, create_refresh_token,
    hash_password, verify_password, revoke_token, refresh_access_token,
    extract_token,
    can_read, can_write, can_delete, can_admin,
    can_manage_team, can_manage_members, can_manage_achievements,
    permission_error, auth_error, locked_error, get_role_info,
    is_account_locked, record_failed_attempt, clear_failed_attempts,
    MAX_FAILED_ATTEMPTS, ACCESS_TOKEN_EXPIRY,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ── Helpers ───────────────────────────────────────────────────────────────────

def resp(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def err(status: int, message: str) -> dict:
    return resp(status, {"error": message})


def parse_body(event: dict) -> dict:
    raw = event.get("body") or "{}"
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return raw if isinstance(raw, dict) else {}


def to_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serialisable dict."""
    if doc is None:
        return {}
    doc["id"] = str(doc.pop("_id"))
    return doc


def valid_oid(oid: str) -> bool:
    try:
        ObjectId(oid)
        return True
    except (InvalidId, TypeError):
        return False


def qs(event: dict) -> dict:
    return event.get("queryStringParameters") or {}


# ── Seed / bootstrap ──────────────────────────────────────────────────────────

def seed_admin(db):
    users = db["users"]
    if users.count_documents({}) == 0:
        users.insert_many([
            {
                "username": "admin",
                "password": hash_password("admin123"),
                "role": "admin",
                "full_name": "System Admin",
                "email": "admin@acme.com",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "username": "manager1",
                "password": hash_password("manager123"),
                "role": "manager",
                "full_name": "Team Manager",
                "email": "manager@acme.com",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "username": "contrib1",
                "password": hash_password("contrib123"),
                "role": "contributor",
                "full_name": "Team Contributor",
                "email": "contrib@acme.com",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "username": "viewer1",
                "password": hash_password("viewer123"),
                "role": "viewer",
                "full_name": "Read Only",
                "email": "viewer@acme.com",
                "created_at": datetime.now(timezone.utc),
            },
        ])
        return True
    return False


# ── Auth handlers ─────────────────────────────────────────────────────────────

def handle_login(event, db):
    body = parse_body(event)
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        return err(400, "username and password are required")

    # Check if account is locked
    locked, minutes = is_account_locked(username)
    if locked:
        return locked_error(minutes)

    user = db["users"].find_one({"username": username})
    if not user or not verify_password(password, user["password"]):
        attempts = record_failed_attempt(username)
        remaining = MAX_FAILED_ATTEMPTS - attempts
        if remaining > 0:
            return err(401, f"Invalid credentials. {remaining} attempt(s) remaining before lockout.")
        return err(401, "Invalid credentials. Account is now locked.")

    # Successful login — clear failed attempts
    clear_failed_attempts(username)

    user_id  = str(user["_id"])
    uname    = user["username"]
    role     = user["role"]

    return resp(200, {
        "access_token":  create_access_token(user_id, uname, role),
        "refresh_token": create_refresh_token(user_id, uname),
        "token_type":    "Bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRY * 60,
        "token":         create_access_token(user_id, uname, role),  # backwards compat
        "user": {
            "id":       user_id,
            "username": uname,
            "role":     role,
            "full_name": user.get("full_name", ""),
            "email":    user.get("email", ""),
        }
    })


def handle_seed(event, db):
    seeded = seed_admin(db)
    return resp(200, {"seeded": seeded, "message": "Default users ready"})


# ── Users CRUD ────────────────────────────────────────────────────────────────

def handle_users(event, method, path_parts, db, user):
    if not can_admin(user):
        return permission_error("admin")

    col = db["users"]

    if method == "GET" and len(path_parts) == 0:
        docs = [to_doc(d) for d in col.find({}, {"password": 0})]
        return resp(200, docs)

    if method == "POST":
        body = parse_body(event)
        for f in ["username", "password", "role"]:
            if not body.get(f):
                return err(400, f"{f} is required")
        if body["role"] not in ["admin", "manager", "contributor", "viewer"]:
            return err(400, "Invalid role")
        if col.find_one({"username": body["username"]}):
            return err(400, "Username already exists")
        doc = {
            "username": body["username"],
            "password": hash_password(body["password"]),
            "role": body["role"],
            "full_name": body.get("full_name", ""),
            "email": body.get("email", ""),
            "created_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        doc.pop("password")
        return resp(201, doc)

    uid = path_parts[0] if path_parts else None
    if not uid or not valid_oid(uid):
        return err(400, "Invalid user id")

    if method == "PUT":
        body = parse_body(event)
        update = {}
        for f in ["full_name", "email", "role"]:
            if f in body:
                update[f] = body[f]
        if "password" in body and body["password"]:
            update["password"] = hash_password(body["password"])
        if not update:
            return err(400, "No fields to update")
        result = col.update_one({"_id": ObjectId(uid)}, {"$set": update})
        if result.matched_count == 0:
            return err(404, "User not found")
        return resp(200, {"message": "Updated"})

    if method == "DELETE":
        result = col.delete_one({"_id": ObjectId(uid)})
        if result.deleted_count == 0:
            return err(404, "User not found")
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Teams CRUD ────────────────────────────────────────────────────────────────

def handle_teams(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["teams"]

    if method == "GET" and not path_parts:
        q = qs(event)
        query = {}
        if q.get("search"):
            query["name"] = {"$regex": q["search"], "$options": "i"}
        if q.get("location"):
            query["location"] = {"$regex": q["location"], "$options": "i"}
        docs = [to_doc(d) for d in col.find(query).sort("name", 1)]
        return resp(200, docs)

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        for f in ["name"]:
            if not (body.get(f) or "").strip():
                return err(400, f"{f} is required")
        if col.find_one({"name": body["name"]}):
            return err(400, "Team name already exists")
        doc = {
            "name": body["name"].strip(),
            "description": body.get("description", ""),
            "location": body.get("location", ""),
            "department": body.get("department", ""),
            "team_leader": body.get("team_leader", ""),
            "leader_location": body.get("leader_location", ""),
            "org_leader": body.get("org_leader", ""),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return resp(201, doc)

    tid = path_parts[0] if path_parts else None
    if not tid or not valid_oid(tid):
        return err(400, "Invalid team id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(tid)})
        if not doc:
            return err(404, "Team not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        update = {k: body[k] for k in [
            "name", "description", "location", "department",
            "team_leader", "leader_location", "org_leader"
        ] if k in body}
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one({"_id": ObjectId(tid)}, {"$set": update})
        if result.matched_count == 0:
            return err(404, "Team not found")
        doc = col.find_one({"_id": ObjectId(tid)})
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        result = col.delete_one({"_id": ObjectId(tid)})
        if result.deleted_count == 0:
            return err(404, "Team not found")
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Members CRUD ──────────────────────────────────────────────────────────────

def handle_members(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["members"]

    if method == "GET" and not path_parts:
        q = qs(event)
        query = {}
        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        if q.get("search"):
            query["$or"] = [
                {"name": {"$regex": q["search"], "$options": "i"}},
                {"email": {"$regex": q["search"], "$options": "i"}},
                {"role": {"$regex": q["search"], "$options": "i"}},
            ]
        docs = [to_doc(d) for d in col.find(query).sort("name", 1)]
        return resp(200, docs)

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        for f in ["name", "team_id"]:
            if not (body.get(f) or "").strip():
                return err(400, f"{f} is required")
        if not valid_oid(body["team_id"]):
            return err(400, "Invalid team_id")
        doc = {
            "name": body["name"].strip(),
            "team_id": body["team_id"],
            "email": body.get("email", ""),
            "role": body.get("role", ""),
            "location": body.get("location", ""),
            "employment_type": body.get("employment_type", "direct"),  # direct | non-direct
            "is_team_leader": bool(body.get("is_team_leader", False)),
            "start_date": body.get("start_date", ""),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return resp(201, doc)

    mid = path_parts[0] if path_parts else None
    if not mid or not valid_oid(mid):
        return err(400, "Invalid member id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(mid)})
        if not doc:
            return err(404, "Member not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        update = {k: body[k] for k in [
            "name", "email", "role", "location",
            "employment_type", "is_team_leader", "start_date", "team_id"
        ] if k in body}
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one({"_id": ObjectId(mid)}, {"$set": update})
        if result.matched_count == 0:
            return err(404, "Member not found")
        doc = col.find_one({"_id": ObjectId(mid)})
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        result = col.delete_one({"_id": ObjectId(mid)})
        if result.deleted_count == 0:
            return err(404, "Member not found")
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Achievements CRUD ─────────────────────────────────────────────────────────

def handle_achievements(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["achievements"]

    if method == "GET" and not path_parts:
        q = qs(event)
        query = {}
        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        if q.get("month"):
            query["month"] = int(q["month"])
        if q.get("year"):
            query["year"] = int(q["year"])
        docs = [to_doc(d) for d in col.find(query).sort("year", -1)]
        return resp(200, docs)

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        for f in ["title", "team_id", "month", "year"]:
            if body.get(f) in (None, ""):
                return err(400, f"{f} is required")
        if not valid_oid(body["team_id"]):
            return err(400, "Invalid team_id")
        try:
            month = int(body["month"])
            year = int(body["year"])
            assert 1 <= month <= 12
            assert 2000 <= year <= 2100
        except (ValueError, AssertionError):
            return err(400, "month must be 1-12, year must be 2000-2100")
        doc = {
            "title": body["title"].strip(),
            "team_id": body["team_id"],
            "description": body.get("description", ""),
            "month": month,
            "year": year,
            "impact": body.get("impact", ""),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return resp(201, doc)

    aid = path_parts[0] if path_parts else None
    if not aid or not valid_oid(aid):
        return err(400, "Invalid achievement id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(aid)})
        if not doc:
            return err(404, "Achievement not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        update = {k: body[k] for k in [
            "title", "description", "month", "year", "impact", "team_id"
        ] if k in body}
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one({"_id": ObjectId(aid)}, {"$set": update})
        if result.matched_count == 0:
            return err(404, "Achievement not found")
        doc = col.find_one({"_id": ObjectId(aid)})
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        result = col.delete_one({"_id": ObjectId(aid)})
        if result.deleted_count == 0:
            return err(404, "Achievement not found")
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Metadata CRUD ─────────────────────────────────────────────────────────────

def handle_metadata(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["metadata"]

    if method == "GET" and not path_parts:
        q = qs(event)
        query = {}
        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        docs = [to_doc(d) for d in col.find(query)]
        return resp(200, docs)

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        for f in ["team_id", "key", "value"]:
            if body.get(f) in (None, ""):
                return err(400, f"{f} is required")
        if not valid_oid(body["team_id"]):
            return err(400, "Invalid team_id")
        doc = {
            "team_id": body["team_id"],
            "key": body["key"].strip(),
            "value": body["value"],
            "category": body.get("category", "general"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return resp(201, doc)

    mid = path_parts[0] if path_parts else None
    if not mid or not valid_oid(mid):
        return err(400, "Invalid metadata id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(mid)})
        if not doc:
            return err(404, "Metadata not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        update = {k: body[k] for k in ["key", "value", "category", "team_id"] if k in body}
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one({"_id": ObjectId(mid)}, {"$set": update})
        if result.matched_count == 0:
            return err(404, "Metadata not found")
        doc = col.find_one({"_id": ObjectId(mid)})
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        result = col.delete_one({"_id": ObjectId(mid)})
        if result.deleted_count == 0:
            return err(404, "Metadata not found")
        return resp(204, {})

    return err(405, "Method not allowed")



def handle_roles():
    """Return all available roles and their permissions — public endpoint."""
    from auth import get_role_info
    roles = ["viewer", "contributor", "manager", "admin"]
    return resp(200, {
        "roles": [get_role_info(r) for r in roles],
        "description": "Roles in ascending order of privilege"
    })

# ── Stats / dashboard aggregations ───────────────────────────────────────────

def handle_stats(db, user):
    if not can_read(user):
        return auth_error()

    teams = list(db["teams"].find())
    members = list(db["members"].find())

    total_teams = len(teams)
    total_members = len(members)

    # Leader not co-located
    leader_not_colocated = sum(
        1 for t in teams
        if t.get("team_leader") and t.get("location") and t.get("leader_location")
        and t["location"].lower() != t["leader_location"].lower()
    )

    # Leader is non-direct staff
    leader_non_direct = 0
    for t in teams:
        if t.get("team_leader"):
            leader_member = next(
                (m for m in members
                 if m.get("team_id") == str(t["_id"]) and m.get("is_team_leader")),
                None
            )
            if leader_member and leader_member.get("employment_type") == "non-direct":
                leader_non_direct += 1

    # Non-direct ratio > 20%
    high_nondirect = 0
    for t in teams:
        team_members = [m for m in members if m.get("team_id") == str(t["_id"])]
        if team_members:
            non_direct = sum(1 for m in team_members if m.get("employment_type") == "non-direct")
            if non_direct / len(team_members) > 0.2:
                high_nondirect += 1

    # Teams reporting to an org leader
    has_org_leader = sum(1 for t in teams if t.get("org_leader"))

    # Achievement count
    total_achievements = db["achievements"].count_documents({})

    return resp(200, {
        "total_teams": total_teams,
        "total_members": total_members,
        "total_achievements": total_achievements,
        "leader_not_colocated": leader_not_colocated,
        "leader_non_direct": leader_non_direct,
        "high_nondirect_ratio": high_nondirect,
        "has_org_leader": has_org_leader,
    })


# ── Router ────────────────────────────────────────────────────────────────────

def handler(event=None, context=None):
    if event is None:
        event = {}

    method = (event.get("requestContext", {}).get("http", {}).get("method")
              or event.get("httpMethod", "GET")).upper()

    # Handle CORS preflight
    if method == "OPTIONS":
        return resp(204, {})

    raw_path = (event.get("requestContext", {}).get("http", {}).get("path")
                or event.get("path", "/"))

    # Strip prefix up to and including the service name
    # e.g. /api/team-service/teams/123  or  /teams/123
    path = re.sub(r"^(/[^/]+/team-service|/api/[^/]+)", "", raw_path).strip("/")
    parts = [p for p in path.split("/") if p]

    resource = parts[0] if parts else ""
    sub_parts = parts[1:] if len(parts) > 1 else []

    try:
        db = get_db()
        # Ensure default users exist on every cold start
        seed_admin(db)

        user = get_current_user(event)

        # Public routes
        if resource == "auth":
            action = sub_parts[0] if sub_parts else (parts[1] if len(parts) > 1 else "")
            if not action and len(parts) > 1:
                action = parts[1]
            # parts = ["auth", "login"] → resource="auth", sub_parts=["login"]
            action = sub_parts[0] if sub_parts else ""
            if action == "login" and method == "POST":
                return handle_login(event, db)
            if action == "seed" and method == "POST":
                return handle_seed(event, db)
            if action == "refresh" and method == "POST":
                body = parse_body(event)
                refresh_tok = body.get("refresh_token", "")
                if not refresh_tok:
                    return err(400, "refresh_token is required")
                result = refresh_access_token(refresh_tok, db)
                if not result:
                    return err(401, "Invalid or expired refresh token")
                return resp(200, result)
            if action == "logout" and method == "POST":
                token = extract_token(event)
                if token:
                    revoke_token(token)
                return resp(200, {"message": "Logged out successfully"})
            return err(404, "Auth endpoint not found")

        # Protected resources
        dispatch = {
            "users":        handle_users,
            "teams":        handle_teams,
            "members":      handle_members,
            "achievements": handle_achievements,
            "metadata":     handle_metadata,
        }

        if resource == "stats":
            return handle_stats(db, user)

        if resource == "roles":
            return handle_roles()

        if resource in dispatch:
            return dispatch[resource](event, method, sub_parts, db, user)

        # Root health check
        if not resource:
            return resp(200, {"status": "ok", "service": "team-service"})

        return err(404, f"Resource '{resource}' not found")

    except Exception as e:
        logger.error("Unhandled error: %s", e, exc_info=True)
        reset_client()
        return err(500, "Internal server error")


if __name__ == "__main__":
    # Quick local smoke test
    import os
    os.environ["IS_LOCAL"] = "true"
    print(handler({"requestContext": {"http": {"method": "POST", "path": "/auth/seed"}}, "body": "{}"}))
    print(handler({"requestContext": {"http": {"method": "POST", "path": "/auth/login"}},
                   "body": '{"username":"admin","password":"admin123"}'}))
