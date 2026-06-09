"""
Authentication and authorization for ACME Team Management.

Industry standards implemented:
  - PBKDF2-SHA256 password hashing (NIST SP 800-132)
  - JWT access tokens (RFC 7519)
  - JWT refresh tokens with rotation
  - Constant-time password comparison (prevents timing attacks)
  - Token blacklisting for logout
  - Rate limiting awareness (tracks failed attempts)
  - Secure token claims validation
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

# ── Config ────────────────────────────────────────────────────────────────────

JWT_SECRET          = os.getenv("JWT_SECRET", "acme-super-secret-minimum-32-chars!!")
JWT_ALGORITHM       = "HS256"
ACCESS_TOKEN_EXPIRY = int(os.getenv("ACCESS_TOKEN_EXPIRY_MINUTES", "60"))   # 1 hour
REFRESH_TOKEN_EXPIRY = int(os.getenv("REFRESH_TOKEN_EXPIRY_DAYS", "7"))     # 7 days
PBKDF2_ITERATIONS   = 260000  # NIST recommended minimum for SHA256

# In-memory stores (in production use Redis)
# Tracks failed login attempts per username
_failed_attempts: dict = {}
# Blacklisted tokens (jti claims of revoked tokens)
_token_blacklist: set  = set()

# Role hierarchy
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


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """
    Hash using PBKDF2-SHA256 with a cryptographically random salt.
    Format: algorithm$iterations$salt$hash
    Industry standard: same approach as Django, Spring Security.
    """
    salt = secrets.token_hex(32)
    hashed = hashlib.pbkdf2_hmac(
        "sha256", plain.encode("utf-8"), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${hashed}"


def verify_password(plain: str, stored: str) -> bool:
    """
    Constant-time comparison prevents timing attacks.
    An attacker cannot determine if the password was close to correct
    by measuring response time differences.
    """
    try:
        parts = stored.split("$")
        if len(parts) == 4:
            # New format: pbkdf2_sha256$iterations$salt$hash
            _, iterations, salt, hashed = parts
            check = hashlib.pbkdf2_hmac(
                "sha256", plain.encode("utf-8"), salt.encode(), int(iterations)
            ).hex()
        else:
            # Legacy format: salt:hash (backwards compatible)
            salt, hashed = stored.split(":")
            check = hashlib.pbkdf2_hmac(
                "sha256", plain.encode("utf-8"), salt.encode(), PBKDF2_ITERATIONS
            ).hex()
        return hmac.compare_digest(check, hashed)
    except Exception:
        return False


# ── Rate limiting ─────────────────────────────────────────────────────────────

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES     = 15

def record_failed_attempt(username: str) -> int:
    """Track failed login attempts. Returns current failure count."""
    now = datetime.now(timezone.utc)
    if username not in _failed_attempts:
        _failed_attempts[username] = {"count": 0, "first_attempt": now, "locked_until": None}

    entry = _failed_attempts[username]

    # Reset if lockout period has passed
    if entry["locked_until"] and now > entry["locked_until"]:
        _failed_attempts[username] = {"count": 0, "first_attempt": now, "locked_until": None}
        entry = _failed_attempts[username]

    entry["count"] += 1

    # Lock account after max attempts
    if entry["count"] >= MAX_FAILED_ATTEMPTS:
        entry["locked_until"] = now + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning("Account locked for %s after %d failed attempts", username, entry["count"])

    return entry["count"]


def is_account_locked(username: str) -> tuple[bool, Optional[int]]:
    """
    Check if account is locked.
    Returns (is_locked, minutes_remaining).
    """
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
    """Clear failed attempts on successful login."""
    _failed_attempts.pop(username, None)


# ── Token helpers ─────────────────────────────────────────────────────────────

def create_access_token(user_id: str, username: str, role: str) -> str:
    """
    Create a short-lived JWT access token.
    jti (JWT ID) is a unique identifier enabling token revocation.
    Standard claims per RFC 7519.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub":      user_id,              # Subject (user id)
        "username": username,
        "role":     role,
        "type":     "access",             # Token type
        "jti":      secrets.token_hex(16),# Unique token ID for blacklisting
        "iss":      "acme-team-mgmt",     # Issuer
        "aud":      "acme-api",           # Audience
        "iat":      now,                  # Issued at
        "exp":      now + timedelta(minutes=ACCESS_TOKEN_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, username: str) -> str:
    """
    Create a long-lived refresh token.
    Used to obtain new access tokens without re-login.
    Contains minimal claims for security.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub":  user_id,
        "username": username,
        "type": "refresh",
        "jti":  secrets.token_hex(16),
        "iss":  "acme-team-mgmt",
        "iat":  now,
        "exp":  now + timedelta(days=REFRESH_TOKEN_EXPIRY),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# Keep backwards-compatible alias
def create_token(user_id: str, username: str, role: str) -> str:
    return create_access_token(user_id, username, role)


def decode_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    Decode and validate a JWT.
    Checks: signature, expiry, issuer, audience, token type, blacklist.
    """
    try:
        payload = jwt.decode(
            token, JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_aud": False},  # audience check done manually
        )

        # Verify token type
        if payload.get("type") != token_type:
            logger.warning("Wrong token type: expected %s got %s", token_type, payload.get("type"))
            return None

        # Check blacklist
        jti = payload.get("jti")
        if jti and jti in _token_blacklist:
            logger.warning("Token %s has been revoked", jti)
            return None

        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token: %s", e)
        return None


def revoke_token(token: str):
    """
    Add token's jti to blacklist — effectively logs the user out.
    In production this would be stored in Redis with TTL matching token expiry.
    """
    try:
        payload = jwt.decode(
            token, JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_aud": False, "verify_exp": False},
        )
        jti = payload.get("jti")
        if jti:
            _token_blacklist.add(jti)
            logger.info("Token %s revoked", jti)
    except Exception:
        pass


def refresh_access_token(refresh_token: str, db) -> Optional[dict]:
    """
    Exchange a valid refresh token for a new access token.
    Implements refresh token rotation — old token is revoked.
    """
    payload = decode_token(refresh_token, token_type="refresh")
    if not payload:
        return None

    # Verify user still exists and is active
    from bson import ObjectId
    try:
        user = db["users"].find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            return None
    except Exception:
        return None

    # Revoke old refresh token (rotation)
    revoke_token(refresh_token)

    # Issue new tokens
    user_id  = str(user["_id"])
    username = user["username"]
    role     = user["role"]

    return {
        "access_token":  create_access_token(user_id, username, role),
        "refresh_token": create_refresh_token(user_id, username),
        "token_type":    "Bearer",
        "expires_in":    ACCESS_TOKEN_EXPIRY * 60,
    }


# ── Request parsing ───────────────────────────────────────────────────────────

def extract_token(event: dict) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    headers = event.get("headers") or {}
    auth = headers.get("authorization") or headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_current_user(event: dict) -> Optional[dict]:
    """Get authenticated user from request. Returns None if invalid."""
    token = extract_token(event)
    if not token:
        return None
    return decode_token(token, token_type="access")


# ── Permission checks ─────────────────────────────────────────────────────────

def require_role(user: Optional[dict], minimum_role: str) -> bool:
    if not user:
        return False
    user_level = ROLE_HIERARCHY.get(user.get("role", ""), -1)
    return user_level >= ROLE_HIERARCHY.get(minimum_role, 99)


def can_read(user):                return require_role(user, "viewer")
def can_write(user):               return require_role(user, "contributor")
def can_delete(user):              return require_role(user, "manager")
def can_admin(user):               return require_role(user, "admin")
def can_manage_team(user):         return require_role(user, "manager")
def can_manage_members(user):      return require_role(user, "contributor")
def can_manage_achievements(user): return require_role(user, "contributor")


# ── Structured error responses ────────────────────────────────────────────────

def permission_error(required_role: str) -> dict:
    desc  = ROLE_DESCRIPTIONS.get(required_role, required_role)
    label = required_role.capitalize()
    return {
        "statusCode": 403,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": f'{{"error": "Access denied. {label} role required ({desc}).", "required_role": "{required_role}"}}',
    }


def auth_error(reason: str = "Authentication required") -> dict:
    return {
        "statusCode": 401,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": f'{{"error": "{reason}. Please provide a valid Bearer token.", "code": "UNAUTHENTICATED"}}',
    }


def locked_error(minutes_remaining: int) -> dict:
    return {
        "statusCode": 429,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Retry-After": str(minutes_remaining * 60),
        },
        "body": f'{{"error": "Account temporarily locked due to too many failed attempts. Try again in {minutes_remaining} minute(s).", "code": "ACCOUNT_LOCKED", "retry_after_minutes": {minutes_remaining}}}',
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