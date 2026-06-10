"""
ACME Inc. Team Management — Lambda handler.
All routes handled in a single function following the workshop pattern.
"""

import json
import logging
import re
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone

from mongo_service import get_db, reset_client, ensure_indexes
from auth import (
    get_current_user, create_token, create_access_token, create_refresh_token,
    hash_password, verify_password, revoke_token, refresh_access_token,
    extract_token,
    can_read, can_write, can_delete, can_admin,
    can_manage_team, can_manage_members, can_manage_achievements,
    permission_error, auth_error, locked_error, get_role_info,
    is_account_locked, record_failed_attempt, clear_failed_attempts,
    MAX_FAILED_ATTEMPTS, SENSITIVE_FIELDS, get_cors_origin,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MAX_BODY_SIZE = 50_000


# ── Helpers ───────────────────────────────────────────────────────────────────

def resp(status: int, body, event: dict = None) -> dict:
    origin = get_cors_origin(event or {})
    return {
        "statusCode": status,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  origin,
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Vary":                         "Origin",
        },
        "body": json.dumps(body, default=str),
    }


def err(status: int, message: str, event: dict = None) -> dict:
    return resp(status, {"error": message}, event)


def parse_body(event: dict) -> dict:
    raw = event.get("body") or "{}"
    if len(str(raw)) > MAX_BODY_SIZE:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return raw if isinstance(raw, dict) else {}


def to_doc(doc: dict) -> dict:
    """Convert MongoDB document to safe JSON-serialisable dict."""
    if doc is None:
        return {}
    doc["id"] = str(doc.pop("_id"))
    for field in SENSITIVE_FIELDS:
        doc.pop(field, None)
    return doc


def valid_oid(oid: str) -> bool:
    try:
        ObjectId(oid)
        return True
    except (InvalidId, TypeError):
        return False


def qs(event: dict) -> dict:
    return event.get("queryStringParameters") or {}


def escape_regex(s: str) -> str:
    """Escape special regex chars to prevent injection."""
    return re.escape(s)


def active_filter(extra: dict = None) -> dict:
    """Query filter that excludes soft-deleted documents."""
    q = {"deleted": {"$ne": True}}
    if extra:
        q.update(extra)
    return q


def soft_delete(col, oid: ObjectId, user: dict) -> bool:
    """Mark document as deleted — preserves data, enables recovery."""
    result = col.update_one(
        {"_id": oid, "deleted": {"$ne": True}},
        {"$set": {
            "deleted":    True,
            "deleted_at": datetime.now(timezone.utc),
            "deleted_by": user.get("username", "unknown"),
        }}
    )
    return result.modified_count > 0


# ── Audit Log ─────────────────────────────────────────────────────────────────

def log_audit(db, user: dict, action: str, resource: str, resource_id: str = None, 
              changes: dict = None, details: str = None):
    """
    Record every mutation to the audit_log collection.
    action:   CREATE | UPDATE | DELETE | LOGIN | LOGOUT | LOGIN_FAILED | EXPORT
    resource: teams | members | achievements | metadata | users | auth
    """
    try:
        db["audit_log"].insert_one({
            "action":      action,
            "resource":    resource,
            "resource_id": resource_id,
            "user_id":     user.get("sub", "unknown") if user else "system",
            "username":    user.get("username", "unknown") if user else "system",
            "role":        user.get("role", "unknown") if user else "system",
            "changes":     changes or {},
            "details":     details or "",
            "timestamp":   datetime.now(timezone.utc),
            "ip":          "lambda",
        })
    except Exception as e:
        logger.warning("Audit log failed: %s", e)


# ── Audit Trail handler ───────────────────────────────────────────────────────

def handle_audit(event, method, path_parts, db, user):
    """
    GET /audit          - list recent audit log entries (manager+)
    GET /audit/{id}     - get single audit entry
    Supports filters: ?resource= ?action= ?username= ?limit= ?from_date=
    """
    if not can_manage_team(user):
        return permission_error("manager")

    col = db["audit_log"]
    q   = qs(event)

    if method == "GET" and not path_parts:
        query  = {}
        limit  = min(int(q.get("limit", 50)), 200)

        if q.get("resource"):
            query["resource"] = q["resource"]
        if q.get("action"):
            query["action"] = q["action"].upper()
        if q.get("username"):
            query["username"] = {"$regex": q["username"], "$options": "i"}
        if q.get("from_date"):
            try:
                from_dt = datetime.fromisoformat(q["from_date"])
                query["timestamp"] = {"$gte": from_dt}
            except ValueError:
                return err(400, "Invalid from_date format. Use ISO 8601 e.g. 2026-01-01")

        docs = list(col.find(query).sort([("timestamp", -1)]).limit(limit))
        return resp(200, [to_doc(d) for d in docs])

    if method == "GET" and path_parts:
        aid = path_parts[0]
        if not valid_oid(aid):
            return err(400, "Invalid audit entry id")
        doc = col.find_one({"_id": ObjectId(aid)})
        if not doc:
            return err(404, "Audit entry not found")
        return resp(200, to_doc(doc))

    return err(405, "Method not allowed")


# ── Activity Feed handler ─────────────────────────────────────────────────────

def handle_activity(db, user):
    """
    GET /activity - human-readable activity feed (viewer+)
    Returns last 30 actions formatted as readable sentences.
    """
    if not can_read(user):
        return auth_error()

    col  = db["audit_log"]
    docs = list(col.find({}).sort([("timestamp", -1)]).limit(30))

    ACTION_LABELS = {
        "CREATE": "created",
        "UPDATE": "updated",
        "DELETE": "deleted",
        "LOGIN":  "logged in",
        "LOGOUT": "logged out",
        "LOGIN_FAILED": "failed to log in",
        "EXPORT": "exported",
    }

    RESOURCE_LABELS = {
        "teams":        "team",
        "members":      "member",
        "achievements": "achievement",
        "metadata":     "metadata",
        "users":        "user",
        "auth":         "account",
    }

    feed = []
    for d in docs:
        action   = ACTION_LABELS.get(d.get("action", ""), d.get("action", "").lower())
        resource = RESOURCE_LABELS.get(d.get("resource", ""), d.get("resource", ""))
        username = d.get("username", "Someone")
        ts       = d.get("timestamp")
        details  = d.get("details", "")

        # Build human-readable sentence
        if d.get("action") in ("LOGIN", "LOGOUT", "LOGIN_FAILED"):
            sentence = f"{username} {action}"
        elif details:
            sentence = f"{username} {action} {resource}: {details}"
        else:
            sentence = f"{username} {action} a {resource}"

        feed.append({
            "id":         str(d["_id"]),
            "sentence":   sentence,
            "action":     d.get("action"),
            "resource":   d.get("resource"),
            "resource_id":d.get("resource_id"),
            "username":   username,
            "role":       d.get("role"),
            "timestamp":  ts.isoformat() if ts else None,
            "changes":    d.get("changes", {}),
        })

    return resp(200, feed)


# ── Seed / bootstrap ──────────────────────────────────────────────────────────

def seed_admin(db):
    users = db["users"]
    if users.count_documents({}) == 0:
        users.insert_many([
            {
                "username":     "admin",
                "password":     hash_password("admin123"),
                "role":         "admin",
                "full_name":    "System Administrator",
                "email":        "admin@acme.com",
                "avatar_color": "#FF6B6B",
                "title":        "Platform Admin",
                "department":   "Technology",
                "location":     "New York",
                "created_at":   datetime.now(timezone.utc),
                "last_login":   None,
            },
            {
                "username":     "manager1",
                "password":     hash_password("manager123"),
                "role":         "manager",
                "full_name":    "Sarah Chen",
                "email":        "schen@acme.com",
                "avatar_color": "#FFD166",
                "title":        "Engineering Manager",
                "department":   "Technology",
                "location":     "New York",
                "created_at":   datetime.now(timezone.utc),
                "last_login":   None,
            },
            {
                "username":     "contrib1",
                "password":     hash_password("contrib123"),
                "role":         "contributor",
                "full_name":    "Marcus Webb",
                "email":        "mwebb@acme.com",
                "avatar_color": "#6BCB77",
                "title":        "Senior Engineer",
                "department":   "Analytics",
                "location":     "San Francisco",
                "created_at":   datetime.now(timezone.utc),
                "last_login":   None,
            },
            {
                "username":     "viewer1",
                "password":     hash_password("viewer123"),
                "role":         "viewer",
                "full_name":    "Priya Sharma",
                "email":        "psharma@acme.com",
                "avatar_color": "#4ECDC4",
                "title":        "Design Director",
                "department":   "Product",
                "location":     "London",
                "created_at":   datetime.now(timezone.utc),
                "last_login":   None,
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
        log_audit(db, None, "LOGIN_FAILED", "auth", details=f"Failed login attempt for {username}")
        remaining = MAX_FAILED_ATTEMPTS - attempts
        if remaining > 0:
            return err(401, f"Invalid credentials. {remaining} attempt(s) remaining before lockout.")
        return err(401, "Invalid credentials. Account is now locked.")

    clear_failed_attempts(username)

    # Update last login timestamp
    now = datetime.now(timezone.utc)
    db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": now}}
    )

    user_id  = str(user["_id"])
    uname    = user["username"]
    role     = user["role"]

    log_audit(db, {"username": uname, "role": role, "sub": user_id},
              "LOGIN", "auth", user_id, details=f"{uname} signed in")

    return resp(200, {
        "access_token":  create_access_token(user_id, uname, role),
        "refresh_token": create_refresh_token(user_id, uname),
        "token":         create_access_token(user_id, uname, role),
        "token_type":    "Bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRY * 60,
        "user": {
            "id":           user_id,
            "username":     uname,
            "role":         role,
            "full_name":    user.get("full_name", uname),
            "email":        user.get("email", ""),
            "avatar_color": user.get("avatar_color", "#6BCB77"),
            "title":        user.get("title", ""),
            "department":   user.get("department", ""),
            "location":     user.get("location", ""),
            "last_login":   user.get("last_login").isoformat() if user.get("last_login") else None,
        }
    })



def handle_register(event, db):
    body      = parse_body(event)
    username  = (body.get("username") or "").strip().lower()
    password  = body.get("password") or ""
    email     = (body.get("email") or "").strip().lower()
    full_name = (body.get("full_name") or "").strip()

    errors = {}
    if not username or len(username) < 3:
        errors["username"] = "Username must be at least 3 characters"
    if username and not re.match(r'^[a-z0-9_]+$', username):
        errors["username"] = "Username can only contain letters, numbers, underscores"
    if not password or len(password) < 8:
        errors["password"] = "Password must be at least 8 characters"
    elif not re.search(r'[A-Z]', password):
        errors["password"] = "Password must contain at least one uppercase letter"
    elif not re.search(r'[0-9]', password):
        errors["password"] = "Password must contain at least one number"
    if not email or "@" not in email:
        errors["email"] = "Valid email is required"
    if not full_name:
        errors["full_name"] = "Full name is required"
    if errors:
        return resp(400, {"error": "Validation failed", "fields": errors})

    if db["users"].find_one({"username": username}):
        return resp(400, {"error": "Validation failed", "fields": {"username": "Username already taken"}})
    if db["users"].find_one({"email": email}):
        return resp(400, {"error": "Validation failed", "fields": {"email": "Email already registered"}})

    colors = ["#FF6B6B", "#FFD166", "#6BCB77", "#4ECDC4", "#A29BFE", "#74B9FF", "#FF9F43", "#FD79A8"]
    avatar_color = colors[hash(username) % len(colors)]

    now = datetime.now(timezone.utc)
    doc = {
        "username":     username,
        "password":     hash_password(password),
        "role":         "viewer",
        "full_name":    full_name,
        "email":        email,
        "avatar_color": avatar_color,
        "title":        body.get("title", ""),
        "department":   body.get("department", ""),
        "location":     body.get("location", ""),
        "created_at":   now,
        "last_login":   None,
    }

    result  = db["users"].insert_one(doc)
    user_id = str(result.inserted_id)

    log_audit(db, {"username": username, "role": "viewer", "sub": user_id},
              "CREATE", "users", user_id, details=f"New registration: {username}")

    return resp(201, {
        "access_token":  create_access_token(user_id, username, "viewer"),
        "refresh_token": create_refresh_token(user_id, username),
        "token":         create_access_token(user_id, username, "viewer"),
        "token_type":    "Bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRY * 60,
        "user": {
            "id":           user_id,
            "username":     username,
            "role":         "viewer",
            "full_name":    full_name,
            "email":        email,
            "avatar_color": avatar_color,
            "title":        doc["title"],
            "department":   doc["department"],
            "location":     doc["location"],
            "last_login":   None,
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

    if method == "GET" and not path_parts:
        q     = qs(event)
        query = {}
        if q.get("search"):
            safe = escape_regex(q["search"])
            query["$or"] = [
                {"username":  {"$regex": safe, "$options": "i"}},
                {"full_name": {"$regex": safe, "$options": "i"}},
                {"email":     {"$regex": safe, "$options": "i"}},
            ]
        if q.get("role"):
            query["role"] = q["role"]
        docs = [to_doc(d) for d in col.find(query, {"password": 0}).sort([("username", 1)])]
        return resp(200, docs)

    if method == "POST":
        body = parse_body(event)
        for f in ["username", "password", "role"]:
            if not body.get(f):
                return err(400, f"{f} is required")
        if body["role"] not in ["admin", "manager", "contributor", "viewer"]:
            return err(400, "role must be admin, manager, contributor or viewer")
        if len(body["password"]) < 8:
            return err(400, "Password must be at least 8 characters")
        username = body["username"].strip().lower()
        if col.find_one({"username": username}):
            return err(400, "Username already exists")
        email = (body.get("email") or "").strip().lower()
        if email and col.find_one({"email": email}):
            return err(400, "Email already registered")
        doc = {
            "username":     username,
            "password":     hash_password(body["password"]),
            "role":         body["role"],
            "full_name":    body.get("full_name", ""),
            "email":        email,
            "avatar_color": body.get("avatar_color", "#6BCB77"),
            "title":        body.get("title", ""),
            "department":   body.get("department", ""),
            "location":     body.get("location", ""),
            "created_at":   datetime.now(timezone.utc),
            "last_login":   None,
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id",  None)
        doc.pop("password", None)
        log_audit(db, user, "CREATE", "users", doc["id"], details=f"Created user {username}")
        return resp(201, doc)

    uid = path_parts[0] if path_parts else None
    if not uid or not valid_oid(uid):
        return err(400, "Invalid user id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(uid)}, {"password": 0})
        if not doc:
            return err(404, "User not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        body   = parse_body(event)
        update = {}
        for f in ["full_name", "email", "role", "title",
                  "department", "location", "avatar_color"]:
            if f in body:
                update[f] = body[f]
        if "role" in update and update["role"] not in ["admin", "manager", "contributor", "viewer"]:
            return err(400, "Invalid role")
        if "email" in update:
            update["email"] = update["email"].strip().lower()
        if "password" in body and body["password"]:
            if len(body["password"]) < 8:
                return err(400, "Password must be at least 8 characters")
            update["password"] = hash_password(body["password"])
        if not update:
            return err(400, "No fields to update")
        result = col.update_one(
            {"_id": ObjectId(uid)},
            {"$set": update}
        )
        if result.matched_count == 0:
            return err(404, "User not found")
        doc = col.find_one({"_id": ObjectId(uid)}, {"password": 0})
        log_audit(db, user, "UPDATE", "users", uid, changes={
            k: v for k, v in update.items() if k != "password"
        })
        return resp(200, to_doc(doc))

    if method == "DELETE":
        # Prevent deleting yourself
        if uid == user.get("sub"):
            return err(400, "You cannot delete your own account")
        # Prevent deleting last admin
        if col.count_documents({"role": "admin"}) <= 1:
            target = col.find_one({"_id": ObjectId(uid)})
            if target and target.get("role") == "admin":
                return err(400, "Cannot delete the last admin account")
        result = col.delete_one({"_id": ObjectId(uid)})
        if result.deleted_count == 0:
            return err(404, "User not found")
        log_audit(db, user, "DELETE", "users", uid)
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Teams CRUD ────────────────────────────────────────────────────────────────

def handle_teams(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["teams"]

    if method == "GET" and not path_parts:
        q     = qs(event)
        query = {}
        if q.get("search"):
            safe = escape_regex(q["search"])
            query["$or"] = [
                {"name":        {"$regex": safe, "$options": "i"}},
                {"department":  {"$regex": safe, "$options": "i"}},
                {"location":    {"$regex": safe, "$options": "i"}},
                {"team_leader": {"$regex": safe, "$options": "i"}},
            ]
        if q.get("location"):
            query["location"] = {"$regex": escape_regex(q["location"]), "$options": "i"}
        docs = [to_doc(d) for d in col.find(active_filter(query)).sort([("name", 1)])]
        return resp(200, docs)

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        if not (body.get("name") or "").strip():
            return err(400, "name is required")
        if col.find_one({"name": body["name"], "deleted": {"$ne": True}}):
            return err(400, "Team name already exists")
        doc = {
            "name":            body["name"].strip(),
            "description":     body.get("description", ""),
            "location":        body.get("location", ""),
            "department":      body.get("department", ""),
            "team_leader":     body.get("team_leader", ""),
            "leader_location": body.get("leader_location", ""),
            "org_leader":      body.get("org_leader", ""),
            "created_at":      datetime.now(timezone.utc),
            "updated_at":      datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        log_audit(db, user, "CREATE", "teams", doc["id"], details=doc["name"])
        return resp(201, doc)

    tid = path_parts[0] if path_parts else None
    if not tid or not valid_oid(tid):
        return err(400, "Invalid team id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(tid), "deleted": {"$ne": True}})
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
        if not update:
            return err(400, "No fields to update")
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one(
            {"_id": ObjectId(tid), "deleted": {"$ne": True}},
            {"$set": update}
        )
        if result.matched_count == 0:
            return err(404, "Team not found")
        doc = col.find_one({"_id": ObjectId(tid)})
        log_audit(db, user, "UPDATE", "teams", tid, changes=update)
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        deleted = soft_delete(col, ObjectId(tid), user)
        if not deleted:
            return err(404, "Team not found")
        log_audit(db, user, "DELETE", "teams", tid)
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Members CRUD ──────────────────────────────────────────────────────────────

def handle_members(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["members"]

    if method == "GET" and not path_parts:
        q     = qs(event)
        query = {}
        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        if q.get("search"):
            safe = escape_regex(q["search"])
            query["$or"] = [
                {"name":  {"$regex": safe, "$options": "i"}},
                {"email": {"$regex": safe, "$options": "i"}},
                {"role":  {"$regex": safe, "$options": "i"}},
            ]
        docs = [to_doc(d) for d in col.find(active_filter(query)).sort([("name", 1)])]
        return resp(200, docs)

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        for f in ["team_id", "name"]:
            if not body.get(f):
                return err(400, f"{f} is required")
        if not valid_oid(body["team_id"]):
            return err(400, "Invalid team_id")
        # Verify team exists and is not deleted
        if not db["teams"].find_one({"_id": ObjectId(body["team_id"]), "deleted": {"$ne": True}}):
            return err(404, "Team not found")
        doc = {
            "team_id":         body["team_id"],
            "name":            body["name"].strip(),
            "email":           (body.get("email") or "").strip().lower(),
            "role":            body.get("role", ""),
            "location":        body.get("location", ""),
            "employment_type": body.get("employment_type", "direct"),
            "is_team_leader":  bool(body.get("is_team_leader", False)),
            "start_date":      body.get("start_date", ""),
            "created_at":      datetime.now(timezone.utc),
            "updated_at":      datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        log_audit(db, user, "CREATE", "members", doc["id"], details=doc["name"])
        return resp(201, doc)

    mid = path_parts[0] if path_parts else None
    if not mid or not valid_oid(mid):
        return err(400, "Invalid member id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(mid), "deleted": {"$ne": True}})
        if not doc:
            return err(404, "Member not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body   = parse_body(event)
        update = {k: body[k] for k in [
            "name", "email", "role", "location",
            "employment_type", "is_team_leader",
            "start_date", "team_id"
        ] if k in body}
        if not update:
            return err(400, "No fields to update")
        if "email" in update:
            update["email"] = update["email"].strip().lower()
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one(
            {"_id": ObjectId(mid), "deleted": {"$ne": True}},
            {"$set": update}
        )
        if result.matched_count == 0:
            return err(404, "Member not found")
        doc = col.find_one({"_id": ObjectId(mid)})
        log_audit(db, user, "UPDATE", "members", mid, changes=update)
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        deleted = soft_delete(col, ObjectId(mid), user)
        if not deleted:
            return err(404, "Member not found")
        log_audit(db, user, "DELETE", "members", mid)
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Achievements CRUD ─────────────────────────────────────────────────────────

def handle_achievements(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["achievements"]

    if method == "GET" and not path_parts:
        q     = qs(event)
        query = {}
        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        if q.get("month"):
            try:
                month = int(q["month"])
                if 1 <= month <= 12:
                    query["month"] = month
            except ValueError:
                return err(400, "month must be 1-12")
        if q.get("year"):
            try:
                year = int(q["year"])
                if 2000 <= year <= 2100:
                    query["year"] = year
            except ValueError:
                return err(400, "year must be a valid number")
        if q.get("search"):
            safe = escape_regex(q["search"])
            query["$or"] = [
                {"title":       {"$regex": safe, "$options": "i"}},
                {"description": {"$regex": safe, "$options": "i"}},
                {"impact":      {"$regex": safe, "$options": "i"}},
            ]
        docs = [to_doc(d) for d in col.find(active_filter(query)).sort([("year", -1), ("month", -1)])]
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
        # Verify team exists and is not deleted
        if not db["teams"].find_one({"_id": ObjectId(body["team_id"]), "deleted": {"$ne": True}}):
            return err(404, "Team not found")
        try:
            month = int(body["month"])
            year  = int(body["year"])
            assert 1 <= month <= 12
            assert 2000 <= year <= 2100
        except (ValueError, AssertionError):
            return err(400, "month must be 1-12 and year must be 2000-2100")
        doc = {
            "title":       body["title"].strip(),
            "team_id":     body["team_id"],
            "description": body.get("description", ""),
            "month":       month,
            "year":        year,
            "impact":      body.get("impact", ""),
            "created_at":  datetime.now(timezone.utc),
            "updated_at":  datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        log_audit(db, user, "CREATE", "achievements", doc["id"], details=doc["title"])
        return resp(201, doc)

    aid = path_parts[0] if path_parts else None
    if not aid or not valid_oid(aid):
        return err(400, "Invalid achievement id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(aid), "deleted": {"$ne": True}})
        if not doc:
            return err(404, "Achievement not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body   = parse_body(event)
        update = {k: body[k] for k in [
            "title", "description", "month",
            "year", "impact", "team_id"
        ] if k in body}
        if not update:
            return err(400, "No fields to update")
        if "month" in update:
            try:
                update["month"] = int(update["month"])
                assert 1 <= update["month"] <= 12
            except (ValueError, AssertionError):
                return err(400, "month must be 1-12")
        if "year" in update:
            try:
                update["year"] = int(update["year"])
                assert 2000 <= update["year"] <= 2100
            except (ValueError, AssertionError):
                return err(400, "year must be 2000-2100")
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one(
            {"_id": ObjectId(aid), "deleted": {"$ne": True}},
            {"$set": update}
        )
        if result.matched_count == 0:
            return err(404, "Achievement not found")
        doc = col.find_one({"_id": ObjectId(aid)})
        log_audit(db, user, "UPDATE", "achievements", aid, changes=update)
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        deleted = soft_delete(col, ObjectId(aid), user)
        if not deleted:
            return err(404, "Achievement not found")
        log_audit(db, user, "DELETE", "achievements", aid)
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Metadata CRUD ─────────────────────────────────────────────────────────────

def handle_metadata(event, method, path_parts, db, user):
    if not can_read(user):
        return auth_error()

    col = db["metadata"]

    if method == "GET" and not path_parts:
        q     = qs(event)
        query = {}
        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        if q.get("category"):
            query["category"] = q["category"]
        if q.get("search"):
            safe = escape_regex(q["search"])
            query["$or"] = [
                {"key":   {"$regex": safe, "$options": "i"}},
                {"value": {"$regex": safe, "$options": "i"}},
            ]
        docs = [to_doc(d) for d in col.find(active_filter(query)).sort([("key", 1)])]
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
        # Verify team exists and is not deleted
        if not db["teams"].find_one({"_id": ObjectId(body["team_id"]), "deleted": {"$ne": True}}):
            return err(404, "Team not found")
        # Prevent duplicate keys per team
        if col.find_one({
            "team_id": body["team_id"],
            "key":     body["key"].strip(),
            "deleted": {"$ne": True}
        }):
            return err(400, f"Key '{body['key']}' already exists for this team")
        doc = {
            "team_id":    body["team_id"],
            "key":        body["key"].strip(),
            "value":      body["value"],
            "category":   body.get("category", "general"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        log_audit(db, user, "CREATE", "metadata", doc["id"], details=f"{doc['key']}={doc['value']}")
        return resp(201, doc)

    mid = path_parts[0] if path_parts else None
    if not mid or not valid_oid(mid):
        return err(400, "Invalid metadata id")

    if method == "GET":
        doc = col.find_one({"_id": ObjectId(mid), "deleted": {"$ne": True}})
        if not doc:
            return err(404, "Metadata not found")
        return resp(200, to_doc(doc))

    if method == "PUT":
        if not can_write(user):
            return permission_error("contributor")
        body   = parse_body(event)
        update = {k: body[k] for k in [
            "key", "value", "category", "team_id"
        ] if k in body}
        if not update:
            return err(400, "No fields to update")
        if "key" in update:
            update["key"] = update["key"].strip()
        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one(
            {"_id": ObjectId(mid), "deleted": {"$ne": True}},
            {"$set": update}
        )
        if result.matched_count == 0:
            return err(404, "Metadata not found")
        doc = col.find_one({"_id": ObjectId(mid)})
        log_audit(db, user, "UPDATE", "metadata", mid, changes=update)
        return resp(200, to_doc(doc))

    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        deleted = soft_delete(col, ObjectId(mid), user)
        if not deleted:
            return err(404, "Metadata not found")
        log_audit(db, user, "DELETE", "metadata", mid)
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


# ── Team Notes handler ────────────────────────────────────────────────────────

def handle_notes(event, method, path_parts, db, user):
    """
    GET  /teams/{id}/notes         - get all notes for a team
    POST /teams/{id}/notes         - add a note
    DELETE /teams/{id}/notes/{nid} - delete a note (manager+)
    """
    if not can_read(user):
        return auth_error()

    team_id = path_parts[0] if path_parts else None
    if not team_id or not valid_oid(team_id):
        return err(400, "Invalid team id")

    col = db["team_notes"]

    if method == "GET":
        docs = list(col.find(
            active_filter({"team_id": team_id})
        ).sort([("created_at", -1)]))
        return resp(200, [to_doc(d) for d in docs])

    if method == "POST":
        if not can_write(user):
            return permission_error("contributor")
        body = parse_body(event)
        content = (body.get("content") or "").strip()
        if not content:
            return err(400, "Note content is required")
        if len(content) > 2000:
            return err(400, "Note must be under 2000 characters")

        # Verify team exists
        team = db["teams"].find_one({"_id": ObjectId(team_id), "deleted": {"$ne": True}})
        if not team:
            return err(404, "Team not found")

        doc = {
            "team_id":    team_id,
            "content":    content,
            "author":     user.get("username", "unknown"),
            "author_id":  user.get("sub", ""),
            "pinned":     bool(body.get("pinned", False)),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        log_audit(db, user, "CREATE", "notes", str(result.inserted_id),
                  details=f"Note on team {team.get('name', '')}")
        return resp(201, doc)

    # DELETE /teams/{id}/notes/{nid}
    if method == "DELETE":
        if not can_delete(user):
            return permission_error("manager")
        nid = path_parts[1] if len(path_parts) > 1 else None
        if not nid or not valid_oid(nid):
            return err(400, "Invalid note id")
        deleted = soft_delete(col, ObjectId(nid), user)
        if not deleted:
            return err(404, "Note not found")
        return resp(204, {})

    return err(405, "Method not allowed")


# ── Global Search handler ─────────────────────────────────────────────────────

def handle_search(event, db, user):
    """
    GET /search?q=term
    Searches teams, members, achievements simultaneously.
    Returns grouped results with match counts.
    """
    if not can_read(user):
        return auth_error()

    q_param = (qs(event).get("q") or "").strip()
    if not q_param or len(q_param) < 2:
        return err(400, "Search query must be at least 2 characters")

    if len(q_param) > 100:
        return err(400, "Search query too long")

    regex = {"$regex": q_param, "$options": "i"}

    # Search teams
    teams = [to_doc(d) for d in db["teams"].find(active_filter({"$or": [
        {"name": regex},
        {"description": regex},
        {"department": regex},
        {"location": regex},
        {"team_leader": regex},
        {"org_leader": regex},
    ]})).limit(10)]

    # Search members
    members = [to_doc(d) for d in db["members"].find(active_filter({"$or": [
        {"name": regex},
        {"email": regex},
        {"role": regex},
        {"location": regex},
    ]})).limit(10)]

    # Search achievements
    achievements = [to_doc(d) for d in db["achievements"].find(active_filter({"$or": [
        {"title": regex},
        {"description": regex},
        {"impact": regex},
    ]})).limit(10)]

    total = len(teams) + len(members) + len(achievements)

    return resp(200, {
        "query":        q_param,
        "total":        total,
        "teams":        teams,
        "members":      members,
        "achievements": achievements,
        "counts": {
            "teams":        len(teams),
            "members":      len(members),
            "achievements": len(achievements),
        }
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

    # CORS preflight
    if method == "OPTIONS":
        return resp(204, {}, event)

    # Request size guard
    body_raw = event.get("body") or ""
    if len(str(body_raw)) > MAX_BODY_SIZE:
        return err(413, "Request body too large", event)

    raw_path = (event.get("requestContext", {}).get("http", {}).get("path")
                or event.get("path", "/"))

    path      = re.sub(r"^(/[^/]+/team-service|/api/[^/]+)", "", raw_path).strip("/")
    parts     = [p for p in path.split("/") if p]
    resource  = parts[0] if parts else ""
    sub_parts = parts[1:] if len(parts) > 1 else []

    try:
        db = get_db()
        ensure_indexes(db)
        seed_admin(db)

        user = get_current_user(event)

        # ── Public routes ─────────────────────────────────────────────────────
        if resource == "auth":
            action = sub_parts[0] if sub_parts else ""

            if action == "login" and method == "POST":
                return handle_login(event, db)

            if action == "register" and method == "POST":
                return handle_register(event, db)

            if action == "seed" and method == "POST":
                return handle_seed(event, db)

            if action == "refresh" and method == "POST":
                body        = parse_body(event)
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
                log_audit(db, user, "LOGOUT", "auth",
                          details=f"{user.get('username','unknown')} signed out" if user else "logout")
                return resp(200, {"message": "Logged out successfully"})

            if action == "me" and method == "GET":
                if not user:
                    return auth_error()
                profile = db["users"].find_one(
                    {"_id": ObjectId(user["sub"])},
                    {"password": 0}
                )
                if not profile:
                    return err(404, "User not found")
                return resp(200, to_doc(profile))

            return err(404, f"Auth endpoint '/{action}' not found")

        # ── Public info routes ────────────────────────────────────────────────
        if resource == "roles" and method == "GET":
            roles = ["viewer", "contributor", "manager", "admin"]
            return resp(200, {
                "roles":       [get_role_info(r) for r in roles],
                "description": "Roles in ascending order of privilege",
            })

        # Health check
        if not resource:
            return resp(200, {
                "status":  "ok",
                "service": "team-service",
                "version": "2.0.0",
            })

        # ── Protected routes ──────────────────────────────────────────────────
        dispatch = {
            "users":        handle_users,
            "teams":        handle_teams,
            "members":      handle_members,
            "achievements": handle_achievements,
            "metadata":     handle_metadata,
        }

        if resource == "stats":
            return handle_stats(db, user)

        if resource == "search":
            return handle_search(event, db, user)

        if resource == "activity":
            return handle_activity(db, user)

        if resource == "audit":
            return handle_audit(event, method, sub_parts, db, user)

        # Team notes — /teams/{id}/notes
        if resource == "teams" and len(parts) >= 3 and parts[2] == "notes":
            team_id    = parts[1]
            note_parts = [team_id] + (parts[3:] if len(parts) > 3 else [])
            return handle_notes(event, method, note_parts, db, user)

        if resource in dispatch:
            return dispatch[resource](event, method, sub_parts, db, user)

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
