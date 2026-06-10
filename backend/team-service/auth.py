"""
Authentication and authorization for ACME Team Management.

Industry standards:
  - PBKDF2-SHA256 password hashing (NIST SP 800-132)
  - JWT access + refresh tokens (RFC 7519)
  - Constant-time comparison (prevents timing attacks)
  - Token blacklisting for logout
  - Brute force protection with account lockout
"""

import os
import jwt
import hashlib
import hmac
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

JWT_SECRET           = os.getenv("JWT_SECRET", "acme-super-secret-minimum-32-chars!!")
JWT_ALGORITHM        = "HS256"
ACCESS_TOKEN_EXPIRY  = int(os.getenv("ACCESS_TOKEN_EXPIRY_MINUTES", "60"))
REFRESH_TOKEN_EXPIRY = int(os.getenv("REFRESH_TOKEN_EXPIRY_DAYS",   "7"))
PBKDF2_ITERATIONS    = 260000

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES     = 15

# In-memory stores (use Redis in production)
_failed_attempts: dict = {}
_token_blacklist: set  = set()

ROLE_HIERARCHY = {
    "viewer":      0,
    "contributor": 1,
    "manager":     2,
    "admin":       3,
}

ROLE_DESCRIPTIONS = {
    "viewer":      "read-only access",
    "contributor": "create and update access",
    "manager":     "full CRUD access",
    "admin":       "full system access including user management",
}

ROLE_PERMISSIONS = {
    "viewer":      {"read": True,  "write": False, "delete": False, "admin": False},
    "contributor": {"read": True,  "write": True,  "delete": False, "admin": False},
    "manager":     {"read": True,  "write": True,  "delete": True,  "admin": False},
    "admin":       {"read": True,  "write": True,  "delete": True,  "admin": True},
}

# Fields never returned in API responses
SENSITIVE_FIELDS = {"password", "deleted_by"}

# Allowed CORS origins
ALLOWED_ORIGINS = [
    "https://d3njdoiji9c3r2.cloudfront.net",
    "http://localhost:3000",
    "http://localhost:3001",
]


# ── CORS ──────────────────────────────────────────────────────────────────────

def get_cors_origin(event: dict) -> str:
    """Return the request origin if it's allowed, else the primary origin."""
    headers = event.get("headers") or {}
    origin  = headers.get("origin") or headers.get("Origin", "")
    return origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """PBKDF2-SHA256 with cryptographically random salt. NIST SP 800-132."""
    salt   = secrets.token_hex(32)
    hashed = hashlib.pbkdf2_hmac(
        "sha256", plain.encode("utf-8"), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${hashed}"


def verify_password(plain: str, stored: str) -> bool:
    """Constant-time comparison prevents timing attacks."""
    try:
        parts = stored.split("$")
        if len(parts) == 4:
            _, iterations, salt, hashed = parts
            check = hashlib.pbkdf2_hmac(
                "sha256", plain.encode("utf-8"),
                salt.encode(), int(iterations)
            ).hex()
        else:
            # Legacy format backwards compatibility
            salt, hashed = stored.split(":")
            check = hashlib.pbkdf2_hmac(
                "sha256", plain.encode("utf-8"),
                salt.encode(), PBKDF2_ITERATIONS
            ).hex()
        return hmac.compare_digest(check, hashed)
    except Exception:
        return False


# ── Rate limiting ─────────────────────────────────────────────────────────────

def record_failed_attempt(username: str) -> int:
    now = datetime.now(timezone.utc)
    if username not in _failed_attempts:
        _failed_attempts[username] = {"count": 0, "first_attempt": now, "locked_until": None}
    entry = _failed_attempts[username]
    if entry["locked_until"] and now > entry["locked_until"]:
        _failed_attempts[username] = {"count": 0, "first_attempt": now, "locked_until": None}
        entry = _failed_attempts[username]
    entry["count"] += 1
    if entry["count"] >= MAX_FAILED_ATTEMPTS:
        entry["locked_until"] = now + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning("Account locked: %s after %d attempts", username, entry["count"])
    return entry["count"]


def is_account_locked(username: str) -> tuple:
    if username not in _failed_attempts:
        return False, None
    entry = _failed_attempts[username]
    if not entry.get("locked_until"):
        return False, None
    now = datetime.now(timezone.utc)
    if now < entry["locked_until"]:
        remaining = int((entry["locked_until"] - now).total_seconds() / 60) + 1
        return True, remaining
    return False, None


def clear_failed_attempts(username: str):
    _failed_attempts.pop(username, None)


# ── Token helpers ─────────────────────────────────────────────────────────────

def create_access_token(user_id: str, username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":      user_id,
        "username": username,
        "role":     role,
        "type":     "access",
        "jti":      secrets.token_hex(16),
        "iss":      "acme-team-mgmt",
        "iat":      now,
        "exp":      now + timedelta(minutes=ACCESS_TOKEN_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":      user_id,
        "username": username,
        "type":     "refresh",
        "jti":      secrets.token_hex(16),
        "iss":      "acme-team-mgmt",
        "iat":      now,
        "exp":      now + timedelta(days=REFRESH_TOKEN_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_token(user_id: str, username: str, role: str) -> str:
    """Backwards-compatible alias for create_access_token."""
    return create_access_token(user_id, username, role)


def decode_token(token: str, token_type: str = "access") -> Optional[dict]:
    try:
        payload = jwt.decode(
            token, JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_aud": False},
        )
        if payload.get("type") != token_type:
            return None
        jti = payload.get("jti")
        if jti and jti in _token_blacklist:
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def revoke_token(token: str):
    try:
        payload = jwt.decode(
            token, JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_aud": False, "verify_exp": False},
        )
        jti = payload.get("jti")
        if jti:
            _token_blacklist.add(jti)
    except Exception:
        pass


def refresh_access_token(refresh_token: str, db) -> Optional[dict]:
    payload = decode_token(refresh_token, token_type="refresh")
    if not payload:
        return None
    from bson import ObjectId
    try:
        user = db["users"].find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            return None
    except Exception:
        return None
    revoke_token(refresh_token)
    user_id  = str(user["_id"])
    username = user["username"]
    role     = user["role"]
    return {
        "access_token":  create_access_token(user_id, username, role),
        "refresh_token": create_refresh_token(user_id, username),
        "token":         create_access_token(user_id, username, role),
        "token_type":    "Bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRY * 60,
    }


# ── Request helpers ───────────────────────────────────────────────────────────

def extract_token(event: dict) -> Optional[str]:
    headers = event.get("headers") or {}
    auth = headers.get("authorization") or headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_current_user(event: dict) -> Optional[dict]:
    token = extract_token(event)
    if not token:
        return None
    return decode_token(token, token_type="access")


# ── Permission checks ─────────────────────────────────────────────────────────

def require_role(user: Optional[dict], minimum_role: str) -> bool:
    if not user:
        return False
    return ROLE_HIERARCHY.get(user.get("role", ""), -1) >= ROLE_HIERARCHY.get(minimum_role, 99)


def can_read(user):                return require_role(user, "viewer")
def can_write(user):               return require_role(user, "contributor")
def can_delete(user):              return require_role(user, "manager")
def can_admin(user):               return require_role(user, "admin")
def can_manage_team(user):         return require_role(user, "manager")
def can_manage_members(user):      return require_role(user, "contributor")
def can_manage_achievements(user): return require_role(user, "contributor")


# ── Structured error responses ────────────────────────────────────────────────

def _cors_headers(event: dict = None) -> dict:
    origin = get_cors_origin(event or {})
    return {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":"Authorization, Content-Type",
        "Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS",
        "Vary":                        "Origin",
    }


def permission_error(required_role: str, event: dict = None) -> dict:
    desc  = ROLE_DESCRIPTIONS.get(required_role, required_role)
    label = required_role.capitalize()
    return {
        "statusCode": 403,
        "headers":    _cors_headers(event),
        "body":       f'{{"error":"Access denied. {label} role required ({desc}).","required_role":"{required_role}"}}',
    }


def auth_error(reason: str = "Authentication required", event: dict = None) -> dict:
    return {
        "statusCode": 401,
        "headers":    _cors_headers(event),
        "body":       f'{{"error":"{reason}. Please provide a valid Bearer token.","code":"UNAUTHENTICATED"}}',
    }


def locked_error(minutes_remaining: int, event: dict = None) -> dict:
    return {
        "statusCode": 429,
        "headers": {
            **_cors_headers(event),
            "Retry-After": str(minutes_remaining * 60),
        },
        "body": f'{{"error":"Account locked. Try again in {minutes_remaining} minute(s).","code":"ACCOUNT_LOCKED","retry_after_minutes":{minutes_remaining}}}',
    }


# ── Role info ─────────────────────────────────────────────────────────────────

def get_role_info(role: str) -> dict:
    return {
        "role":        role,
        "label":       role.capitalize(),
        "level":       ROLE_HIERARCHY.get(role, -1),
        "description": ROLE_DESCRIPTIONS.get(role, ""),
        "permissions": ROLE_PERMISSIONS.get(role, {}),
    }
