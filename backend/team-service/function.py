"""
ACME Inc. Team Management — Lambda handler.
All routes handled in a single function following the workshop pattern.
"""

import json
import logging
import re
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone, timedelta, timedelta

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
    ACCESS_TOKEN_EXPIRY,
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


# ── Progress Calculator ───────────────────────────────────────────────────────

def _calc_progress(deliverables: list) -> int:
    """
    Auto-calculate progress from deliverable completion.
    Blocked items (dependency not done) count as 0 even if in_progress.
    """
    if not deliverables:
        return 0

    # Build done set for dependency checking
    done_ids = {d["id"] for d in deliverables if d.get("status") == "done"}

    total = len(deliverables)
    score = 0
    for d in deliverables:
        status = d.get("status", "pending")
        deps   = d.get("depends_on", [])

        # Check if blocked by unfinished dependency
        is_blocked = any(dep_id not in done_ids for dep_id in deps)

        if status == "done":
            score += 100
        elif status == "in_progress" and not is_blocked:
            score += 50
        # blocked or pending = 0

    return round(score / total)


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


# ── Projects & Pipeline handler ───────────────────────────────────────────────

def handle_projects(event, method, path_parts, db, user):
    """
    GET    /projects              - list all projects (viewer+) ?team_id= ?status= ?search=
    POST   /projects              - create project (contributor+)
    GET    /projects/{id}         - get single project (viewer+)
    PUT    /projects/{id}         - update project (contributor+)
    DELETE /projects/{id}         - soft delete (manager+)
    POST   /projects/{id}/members - add member to project
    DELETE /projects/{id}/members/{mid} - remove member from project
    """
    if not can_read(user):
        return auth_error()

    col = db["projects"]

    # ── List projects ─────────────────────────────────────────────────────────
    if method == "GET" and not path_parts:
        q = qs(event)
        query = {}

        if q.get("team_id") and valid_oid(q["team_id"]):
            query["team_id"] = q["team_id"]
        if q.get("status"):
            query["status"] = q["status"]
        if q.get("owner_id"):
            query["owner_id"] = q["owner_id"]
        if q.get("search"):
            safe = escape_regex(q["search"])
            query["$or"] = [
                {"name": {"$regex": safe, "$options": "i"}},
                {"description": {"$regex": safe, "$options": "i"}},
                {"tags": {"$regex": safe, "$options": "i"}},
            ]

        docs = [to_doc(d) for d in col.find(active_filter(query)).sort([("updated_at", -1)])]

        # Add risk flags to each project
        today     = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        risk_date = (datetime.now(timezone.utc) + timedelta(days=14)).strftime('%Y-%m-%d')

        processed = []
        for d in docs:
            due       = d.get("due_date", "")
            progress  = d.get("progress", 0)
            status    = d.get("status", "")
            total_b   = d.get("total_budget", 0)
            spent_b   = d.get("spent_budget", 0)

            is_overdue   = due and due < today and status not in ["completed", "cancelled"]
            is_at_risk   = due and today <= due <= risk_date and progress < 70 and status not in ["completed", "cancelled"]
            is_over_budget = total_b > 0 and spent_b > 0 and (spent_b / total_b) > 0.8

            d["is_overdue"]     = is_overdue
            d["is_at_risk"]     = is_at_risk
            d["is_over_budget"] = is_over_budget
            processed.append(d)

        return resp(200, processed)

    # ── Create project ────────────────────────────────────────────────────────
    if method == "POST" and not path_parts:
        if not can_write(user):
            return permission_error("contributor")

        body = parse_body(event)

        # Validation
        errors = {}
        if not (body.get("name") or "").strip():
            errors["name"] = "Project name is required"
        if not (body.get("team_id") or ""):
            errors["team_id"] = "team_id is required"
        if body.get("team_id") and not valid_oid(body["team_id"]):
            errors["team_id"] = "Invalid team_id"
        if errors:
            return resp(400, {"error": "Validation failed", "fields": errors})

        # Verify team exists
        if not db["teams"].find_one({"_id": ObjectId(body["team_id"]), "deleted": {"$ne": True}}):
            return err(404, "Team not found")

        # Validate status
        valid_statuses = ["backlog", "planning", "in_progress", "review", "completed", "on_hold", "cancelled"]
        status = body.get("status", "backlog")
        if status not in valid_statuses:
            return err(400, f"status must be one of: {', '.join(valid_statuses)}")

        # Validate priority
        valid_priorities = ["low", "medium", "high", "critical"]
        priority = body.get("priority", "medium")
        if priority not in valid_priorities:
            return err(400, f"priority must be one of: {', '.join(valid_priorities)}")

        now = datetime.now(timezone.utc)
        doc = {
            "name":           body["name"].strip(),
            "description":    body.get("description", ""),
            "team_id":        body["team_id"],
            "status":         status,
            "priority":       priority,
            "owner_id":       body.get("owner_id", ""),
            "owner_name":     body.get("owner_name", ""),
            "members":        [],   # populated via /projects/{id}/members
            "tags":           body.get("tags", []),
            "start_date":     body.get("start_date", ""),
            "due_date":       body.get("due_date", ""),
            "progress":       0,    # auto-calculated from deliverables
            "links":          body.get("links", []),

            # Budget fields
            "total_budget":   float(body.get("total_budget", 0)),
            "currency":       body.get("currency", "USD"),

            # Deliverables checklist
            "deliverables":   [],   # list of {id, title, status, created_at}

            "created_by":     user.get("username", ""),
            "created_at":     now,
            "updated_at":     now,
        }

        result = col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        log_audit(db, user, "CREATE", "projects", doc["id"], details=doc["name"])
        return resp(201, doc)

    pid = path_parts[0] if path_parts else None
    if not pid or not valid_oid(pid):
        return err(400, "Invalid project id")

    # ── Get single project ────────────────────────────────────────────────────
    if method == "GET" and len(path_parts) == 1:
        doc = col.find_one({"_id": ObjectId(pid), "deleted": {"$ne": True}})
        if not doc:
            return err(404, "Project not found")

        # Add blocked flag to each deliverable
        done_ids = {d["id"] for d in doc.get("deliverables", []) if d.get("status") == "done"}
        for d in doc.get("deliverables", []):
            deps = d.get("depends_on", [])
            d["is_blocked"] = any(dep_id not in done_ids for dep_id in deps) and d.get("status") != "done"

        return resp(200, to_doc(doc))

    # ── Update project ────────────────────────────────────────────────────────
    if method == "PUT" and len(path_parts) == 1:
        if not can_write(user):
            return permission_error("contributor")

        body = parse_body(event)
        update = {}

        for field in [
            "name", "description", "status", "priority",
            "owner_id", "owner_name", "tags", "start_date",
            "due_date", "links",
        ]:
            if field in body:
                update[field] = body[field]

        if "progress" in body:
            try:
                progress = int(body["progress"])
                assert 0 <= progress <= 100
                update["progress"] = progress
            except (ValueError, AssertionError):
                return err(400, "progress must be 0-100")

        if "status" in update:
            valid_statuses = ["backlog", "planning", "in_progress", "review", "completed", "on_hold", "cancelled"]
            if update["status"] not in valid_statuses:
                return err(400, "Invalid status")
            if update["status"] == "completed":
                update["completed_at"] = datetime.now(timezone.utc)

        if not update:
            return err(400, "No fields to update")

        update["updated_at"] = datetime.now(timezone.utc)
        result = col.update_one(
            {"_id": ObjectId(pid), "deleted": {"$ne": True}},
            {"$set": update},
        )
        if result.matched_count == 0:
            return err(404, "Project not found")

        doc = col.find_one({"_id": ObjectId(pid)})
        log_audit(db, user, "UPDATE", "projects", pid, changes=update)
        return resp(200, to_doc(doc))

    # ── Delete project ────────────────────────────────────────────────────────
    if method == "DELETE" and len(path_parts) == 1:
        if not can_delete(user):
            return permission_error("manager")
        deleted = soft_delete(col, ObjectId(pid), user)
        if not deleted:
            return err(404, "Project not found")
        log_audit(db, user, "DELETE", "projects", pid)
        return resp(204, {})

    # ── Add member to project ─────────────────────────────────────────────────
    if method == "POST" and len(path_parts) >= 2 and path_parts[1] == "members":
        if not can_write(user):
            return permission_error("contributor")

        body = parse_body(event)
        member_id = body.get("member_id", "")
        if not member_id or not valid_oid(member_id):
            return err(400, "Valid member_id is required")

        member = db["members"].find_one({"_id": ObjectId(member_id), "deleted": {"$ne": True}})
        if not member:
            return err(404, "Member not found")

        project = col.find_one({"_id": ObjectId(pid), "deleted": {"$ne": True}})
        if not project:
            return err(404, "Project not found")

        existing_ids = [m.get("member_id") for m in project.get("members", [])]
        if member_id in existing_ids:
            return err(400, "Member already on this project")

        # Cost tracking fields
        daily_rate     = float(body.get("daily_rate", 0))
        days_allocated = float(body.get("days_allocated", 0))
        cost           = round(daily_rate * days_allocated, 2)

        # Read from the canonical member record so project payload stays consistent.
        employment_type = member.get("employment_type", "direct")

        new_member = {
            "member_id":      member_id,
            "member_name":    member.get("name", ""),
            "role":           body.get("role", "member"),
            "member_type":    employment_type,
            "daily_rate":     daily_rate,
            "days_allocated": days_allocated,
            "cost":           cost,
            "added_at":       datetime.now(timezone.utc).isoformat(),
            "added_by":       user.get("username", ""),
        }

        # Recalculate total spent
        all_members  = project.get("members", []) + [new_member]
        spent_budget = round(sum(m.get("cost", 0) for m in all_members), 2)

        col.update_one(
            {"_id": ObjectId(pid)},
            {
                "$push": {"members": new_member},
                "$set":  {
                    "spent_budget": spent_budget,
                    "updated_at":   datetime.now(timezone.utc),
                },
            }
        )
        log_audit(db, user, "UPDATE", "projects", pid,
                                    details=f"Added {member.get('name')} to project")
        return resp(200, {"message": f"{member.get('name')} added", "member": new_member, "spent_budget": spent_budget})

    # ── Remove member from project ────────────────────────────────────────────
    if method == "DELETE" and len(path_parts) >= 3 and path_parts[1] == "members":
        if not can_write(user):
            return permission_error("contributor")

        member_id = path_parts[2]
        result = col.update_one(
            {"_id": ObjectId(pid), "deleted": {"$ne": True}},
            {
                "$pull": {"members": {"member_id": member_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )
        if result.matched_count == 0:
            return err(404, "Project not found")
        log_audit(
            db,
            user,
            "UPDATE",
            "projects",
            pid,
            details=f"Removed member {member_id} from project",
        )
        return resp(200, {"message": "Member removed from project"})

    # ── Add deliverable item ─────────────────────────────────────────────────
    if method == "POST" and len(path_parts) >= 2 and path_parts[1] == "deliverables":
        if not can_write(user):
            return permission_error("contributor")

        body  = parse_body(event)
        title = (body.get("title") or "").strip()
        if not title:
            return err(400, "Deliverable title is required")

        project = col.find_one({"_id": ObjectId(pid)})
        if not project:
            return err(404, "Project not found")

        import uuid
        new_item = {
            "id":           str(uuid.uuid4())[:8],
            "title":        title,
            "status":       "pending",
            "depends_on":   body.get("depends_on", []),  # list of item ids this depends on
            "created_at":   datetime.now(timezone.utc).isoformat(),
            "created_by":   user.get("username", ""),
            "done_at":      None,
            "done_by":      None,
        }

        updated_deliverables = project.get("deliverables", []) + [new_item]
        progress = _calc_progress(updated_deliverables)

        col.update_one(
            {"_id": ObjectId(pid)},
            {"$push": {"deliverables": new_item},
             "$set":  {"progress": progress, "updated_at": datetime.now(timezone.utc)}}
        )
        log_audit(db, user, "UPDATE", "projects", pid, details=f"Added deliverable: {title}")
        return resp(201, {"item": new_item, "progress": progress})

    # ── Update deliverable item status ────────────────────────────────────────
    if method == "PUT" and len(path_parts) >= 3 and path_parts[1] == "deliverables":
        if not can_write(user):
            return permission_error("contributor")

        item_id = path_parts[2]
        body    = parse_body(event)
        new_status = body.get("status", "")

        if new_status not in ["pending", "in_progress", "done"]:
            return err(400, "status must be pending, in_progress, or done")

        project = col.find_one({"_id": ObjectId(pid)})
        if not project:
            return err(404, "Project not found")

        # Update the specific deliverable in the array
        updated = []
        found   = False
        for item in project.get("deliverables", []):
            if item["id"] == item_id:
                item["status"]  = new_status
                item["done_at"] = datetime.now(timezone.utc).isoformat() if new_status == "done" else None
                item["done_by"] = user.get("username") if new_status == "done" else None
                found = True
            updated.append(item)

        if not found:
            return err(404, "Deliverable item not found")

        progress = _calc_progress(updated)

        col.update_one(
            {"_id": ObjectId(pid)},
            {"$set": {
                "deliverables": updated,
                "progress":     progress,
                "updated_at":   datetime.now(timezone.utc),
            }}
        )
        return resp(200, {"progress": progress, "deliverables": updated})

    # ── Delete deliverable item ───────────────────────────────────────────────
    if method == "DELETE" and len(path_parts) >= 3 and path_parts[1] == "deliverables":
        if not can_write(user):
            return permission_error("contributor")

        item_id = path_parts[2]
        project = col.find_one({"_id": ObjectId(pid)})
        if not project:
            return err(404, "Project not found")

        updated  = [d for d in project.get("deliverables", []) if d["id"] != item_id]
        progress = _calc_progress(updated)

        col.update_one(
            {"_id": ObjectId(pid)},
            {"$set": {"deliverables": updated, "progress": progress, "updated_at": datetime.now(timezone.utc)}}
        )
        return resp(200, {"progress": progress, "deliverables": updated})

    return err(405, "Method not allowed")


# ── Pipeline stats ────────────────────────────────────────────────────────────

def handle_pipeline(db, user):
    """
    GET /pipeline
    Returns project counts grouped by status - the kanban overview.
    """
    if not can_read(user):
        return auth_error()

    filt = {"deleted": {"$ne": True}}

    pipeline = [
        {"$match": filt},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "projects": {"$push": {
                "id": {"$toString": "$_id"},
                "name": "$name",
                "priority": "$priority",
                "progress": "$progress",
                "owner_name": "$owner_name",
                "due_date": "$due_date",
                "team_id": "$team_id",
            }},
        }},
        {"$sort": {"_id": 1}},
    ]

    results = list(db["projects"].aggregate(pipeline))
    total = db["projects"].count_documents(filt)
    overdue = db["projects"].count_documents({
        **filt,
        "due_date": {"$lt": datetime.now(timezone.utc).isoformat()},
        "status": {"$nin": ["completed", "cancelled"]},
    })

    status_order = ["backlog", "planning", "in_progress", "review", "completed", "on_hold", "cancelled"]
    status_map = {status: {"count": 0, "projects": []} for status in status_order}

    for result in results:
        if result["_id"] in status_map:
            status_map[result["_id"]] = {
                "count": result["count"],
                "projects": result["projects"],
            }

    return resp(200, {
        "total": total,
        "overdue": overdue,
        "statuses": status_map,
    })


# ── Global Search handler ─────────────────────────────────────────────────────

def handle_search(event, db, user):
    if not can_read(user):
        return auth_error()

    q_param = (qs(event).get("q") or "").strip()
    if not q_param or len(q_param) < 2:
        return err(400, "Search query must be at least 2 characters")
    if len(q_param) > 100:
        return err(400, "Search query too long")

    safe  = escape_regex(q_param)
    regex = {"$regex": safe, "$options": "i"}

    teams = [to_doc(d) for d in db["teams"].find(active_filter({"$or": [
        {"name":        regex},
        {"description": regex},
        {"department":  regex},
        {"location":    regex},
        {"team_leader": regex},
    ]})).limit(8)]

    members = [to_doc(d) for d in db["members"].find(active_filter({"$or": [
        {"name":     regex},
        {"email":    regex},
        {"role":     regex},
        {"location": regex},
    ]})).limit(8)]

    achievements = [to_doc(d) for d in db["achievements"].find(active_filter({"$or": [
        {"title":       regex},
        {"description": regex},
        {"impact":      regex},
    ]})).limit(8)]

    # Search projects collection (not deliverables)
    projects = [to_doc(d) for d in db["projects"].find(active_filter({"$or": [
        {"name":        regex},
        {"description": regex},
        {"owner_name":  regex},
        {"tags":        regex},
    ]})).limit(8)]

    total = len(teams) + len(members) + len(achievements) + len(projects)

    return resp(200, {
        "query":        q_param,
        "total":        total,
        "teams":        teams,
        "members":      members,
        "achievements": achievements,
        "projects":     projects,
        "counts": {
            "teams":        len(teams),
            "members":      len(members),
            "achievements": len(achievements),
            "projects":     len(projects),
        }
    })

# ── Stats / dashboard aggregations ───────────────────────────────────────────

def handle_resources(event, method, db, user):
    """
    GET /resources/allocation
    Shows which members are allocated across multiple active projects.
    Answers: "Which team members are over-allocated?"
    """
    if not can_read(user):
        return auth_error()

    filt        = {"deleted": {"$ne": True}}
    active_filt = {**filt, "status": {"$nin": ["completed", "cancelled"]}}

    # Get all active projects with their members
    active_projects = list(db["projects"].find(active_filt, {
        "name": 1, "status": 1, "members": 1, "due_date": 1, "priority": 1
    }))

    # Build member → projects map
    member_map = {}
    for proj in active_projects:
        proj_id   = str(proj["_id"])
        proj_name = proj.get("name", "")
        for m in proj.get("members", []):
            mid  = m.get("member_id", "")
            name = m.get("member_name", "")
            if not mid:
                continue
            if mid not in member_map:
                member_map[mid] = {
                    "member_id":   mid,
                    "member_name": name,
                    "projects":    [],
                    "total_days":  0,
                    "total_cost":  0,
                }
            member_map[mid]["projects"].append({
                "project_id":   proj_id,
                "project_name": proj_name,
                "status":       proj.get("status", ""),
                "due_date":     proj.get("due_date", ""),
                "priority":     proj.get("priority", ""),
                "role":         m.get("role", ""),
                "days_allocated": m.get("days_allocated", 0),
                "cost":         m.get("cost", 0),
            })
            member_map[mid]["total_days"] += m.get("days_allocated", 0)
            member_map[mid]["total_cost"] += m.get("cost", 0)

    # Tag over-allocated (2+ projects)
    all_allocations = list(member_map.values())
    for a in all_allocations:
        a["project_count"]   = len(a["projects"])
        a["is_over_allocated"] = len(a["projects"]) >= 2

    # Sort by project count descending
    all_allocations.sort(key=lambda x: x["project_count"], reverse=True)

    over_allocated = [a for a in all_allocations if a["is_over_allocated"]]

    return resp(200, {
        "all_allocations":    all_allocations,
        "over_allocated":     over_allocated,
        "over_allocated_count": len(over_allocated),
        "total_allocated":    len(all_allocations),
    })


def handle_admin_fix_members(db, user):
    """Backfill missing project member cost/type fields for legacy seeded data."""
    if not can_admin(user):
        return permission_error("admin")

    projects = list(db["projects"].find({"deleted": {"$ne": True}}))
    fixed = 0

    for proj in projects:
        members = proj.get("members", [])
        needs_update = False
        updated = []

        for m in members:
            member_row = dict(m)
            if "member_type" not in member_row or "daily_rate" not in member_row:
                needs_update = True
                try:
                    member_doc = db["members"].find_one({"_id": ObjectId(member_row.get("member_id", ""))})
                    if member_doc:
                        member_row["member_type"] = member_doc.get("employment_type", "direct")
                except Exception:
                    # Keep current row values when the legacy member cannot be resolved.
                    pass

                member_row["daily_rate"] = member_row.get("daily_rate", 0)
                member_row["days_allocated"] = member_row.get("days_allocated", 0)
                member_row["cost"] = member_row.get("cost", 0)
                member_row["added_at"] = member_row.get("added_at", datetime.now(timezone.utc).isoformat())
                member_row["added_by"] = member_row.get("added_by", "system")

            updated.append(member_row)

        if needs_update:
            db["projects"].update_one(
                {"_id": proj["_id"]},
                {"$set": {"members": updated}}
            )
            fixed += 1

    return resp(200, {"message": f"Fixed {fixed} projects", "total": len(projects)})


def handle_stats(db, user):
    if not can_read(user):
        return auth_error()

    filt        = {"deleted": {"$ne": True}}
    active_filt = {**filt, "status": {"$nin": ["completed", "cancelled"]}}
    today       = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    # ── Basic counts ──────────────────────────────────────────────────────────
    total_teams        = db["teams"].count_documents(filt)
    total_members      = db["members"].count_documents(filt)
    total_achievements = db["achievements"].count_documents(filt)
    total_projects     = db["projects"].count_documents(filt)
    active_projects    = db["projects"].count_documents(active_filt)

    # ── Project health ────────────────────────────────────────────────────────

    # Overdue — past due date, not completed/cancelled
    overdue_projects = db["projects"].count_documents({
        **filt,
        "due_date": {"$lt": today, "$ne": ""},
        "status":   {"$nin": ["completed", "cancelled"]},
    })

    # At risk — due within 14 days AND progress < 70%
    risk_date = (datetime.now(timezone.utc) + timedelta(days=14)).strftime('%Y-%m-%d')
    at_risk_projects = db["projects"].count_documents({
        **filt,
        "due_date": {"$gte": today, "$lte": risk_date},
        "progress": {"$lt": 70},
        "status":   {"$nin": ["completed", "cancelled"]},
    })

    # Budget health — projects where spent > 80% of budget
    budget_pipeline = [
        {"$match": {**filt, "total_budget": {"$gt": 0}}},
        {"$project": {
            "budget_pct": {
                "$multiply": [
                    {"$divide": [{"$ifNull": ["$spent_budget", 0]}, "$total_budget"]},
                    100
                ]
            }
        }},
        {"$match": {"budget_pct": {"$gt": 80}}},
        {"$count": "count"}
    ]
    budget_result = list(db["projects"].aggregate(budget_pipeline))
    over_budget_projects = budget_result[0]["count"] if budget_result else 0

    # Total budget across all projects
    budget_totals = list(db["projects"].aggregate([
        {"$match": filt},
        {"$group": {
            "_id":          None,
            "total_budget": {"$sum": "$total_budget"},
            "spent_budget": {"$sum": {"$ifNull": ["$spent_budget", 0]}},
        }}
    ]))
    total_budget = budget_totals[0]["total_budget"] if budget_totals else 0
    spent_budget = budget_totals[0]["spent_budget"] if budget_totals else 0

    # ── Resource allocation ───────────────────────────────────────────────────

    # Over-allocated — members appearing in 2+ active projects
    active_project_list = list(db["projects"].find(
        active_filt,
        {"members": 1}
    ))

    member_project_count = {}
    for proj in active_project_list:
        for m in proj.get("members", []):
            mid = m.get("member_id", "")
            if mid:
                member_project_count[mid] = member_project_count.get(mid, 0) + 1

    over_allocated = sum(1 for count in member_project_count.values() if count >= 2)

    # ── Team org stats ────────────────────────────────────────────────────────
    leader_not_colocated = db["teams"].count_documents({
        **filt,
        "team_leader":     {"$exists": True, "$ne": ""},
        "location":        {"$exists": True, "$ne": ""},
        "leader_location": {"$exists": True, "$ne": ""},
        "$expr": {"$ne": [
            {"$toLower": "$location"},
            {"$toLower": "$leader_location"},
        ]}
    })

    leader_non_direct = db["members"].count_documents({
        **filt,
        "is_team_leader":  True,
        "employment_type": "non-direct",
    })

    nondirect_pipeline = [
        {"$match": filt},
        {"$group": {
            "_id":        "$team_id",
            "total":      {"$sum": 1},
            "non_direct": {"$sum": {
                "$cond": [{"$eq": ["$employment_type", "non-direct"]}, 1, 0]
            }}
        }},
        {"$match": {"$expr": {"$gt": [
            {"$divide": ["$non_direct", "$total"]}, 0.2
        ]}}},
        {"$count": "count"}
    ]
    nondirect_result     = list(db["members"].aggregate(nondirect_pipeline))
    high_nondirect_ratio = nondirect_result[0]["count"] if nondirect_result else 0

    has_org_leader = db["teams"].count_documents({
        **filt,
        "org_leader": {"$exists": True, "$ne": ""}
    })

    return resp(200, {
        # Project health — answers the 6 business questions
        "total_projects":     total_projects,
        "active_projects":    active_projects,
        "overdue_projects":   overdue_projects,
        "at_risk_projects":   at_risk_projects,
        "over_budget_count":  over_budget_projects,
        "over_allocated":     over_allocated,
        "total_budget":       total_budget,
        "spent_budget":       spent_budget,

        # Org stats
        "total_teams":           total_teams,
        "total_members":         total_members,
        "total_achievements":    total_achievements,
        "leader_not_colocated":  leader_not_colocated,
        "leader_non_direct":     leader_non_direct,
        "high_nondirect_ratio":  high_nondirect_ratio,
        "has_org_leader":        has_org_leader,
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

        if resource == "pipeline":
            return handle_pipeline(db, user)

        if resource == "search":
            return handle_search(event, db, user)

        if resource == "activity":
            return handle_activity(db, user)

        if resource == "resources":
            action = sub_parts[0] if sub_parts else ""
            if action == "allocation":
                return handle_resources(event, method, db, user)
            return err(404, "Resource endpoint not found")

        if resource == "admin":
            action = sub_parts[0] if sub_parts else ""
            if action == "fix-members" and method == "POST":
                return handle_admin_fix_members(db, user)
            return err(404, "Admin endpoint not found")

        if resource == "audit":
            return handle_audit(event, method, sub_parts, db, user)

        if resource == "projects":
            if len(parts) >= 4 and parts[2] == "members":
                return handle_projects(event, method, parts[1:], db, user)
            if len(parts) >= 3 and parts[2] == "members":
                return handle_projects(event, method, parts[1:], db, user)
            return handle_projects(event, method, sub_parts, db, user)

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
