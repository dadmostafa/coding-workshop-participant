"""
Authentication and authorization for ACME Team Management.

Role hierarchy (ascending privilege):
  viewer      -> read only, no modifications
  contributor -> create + update own records, no delete
  manager     -> full CRUD on teams/members/achievements/metadata, no user management
  admin       -> full access including user management and system config

Permission matrix:
  Action              viewer  contributor  manager  admin
  ─────────────────── ─────── ──────────── ─────── ─────
  Read any resource     ✓        ✓           ✓       ✓
  Create records        ✗        ✓           ✓       ✓
  Update records        ✗        ✓           ✓       ✓
  Delete records        ✗        ✗           ✓       ✓
  Manage users          ✗        ✗           ✗       ✓
  View stats/dashboard  ✓        ✓           ✓       ✓
"""

import os
import jwt
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

JWT_SECRET    = os.getenv("JWT_SECRET", "acme-super-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8

# Numeric levels make hierarchy comparisons simple
ROLE_HIERARCHY = {
    "viewer":      0,
    "contributor": 1,
    "manager":     2,
    "admin":       3,
}

ROLE_LABELS = {
    "viewer":      "Viewer",
    "contributor": "Contributor",
    "manager":     "Manager",
    "admin":       "Admin",
}

# Human-readable descriptions shown in API error messages
ROLE_DESCRIPTIONS = {
    "viewer":      "read-only access",
    "contributor": "create and update access",
    "manager":     "full CRUD access",
    "admin":       "full system access",
}


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash password using PBKDF2-SHA256 with a random salt (NIST SP 800-132)."""
    salt = os.urandom(32).hex()
    hashed = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260000).hex()
    return f"{salt}:{hashed}"


def verify_password(plain: str, stored: str) -> bool:
    """Constant-time password verification to prevent timing attacks."""
    try:
        salt, hashed = stored.split(":")
        check = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260000).hex()
        return hmac.compare_digest(check, hashed)
    except Exception:
        return False


# ── Token helpers ─────────────────────────────────────────────────────────────

def create_token(user_id: str, username: str, role: str) -> str:
    """Create a signed JWT with user identity and role."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub":      user_id,
        "username": username,
        "role":     role,
        "exp":      now + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat":      now,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT. Returns None if invalid or expired."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token: %s", e)
        return None


# ── Request helpers ───────────────────────────────────────────────────────────

def extract_token(event: dict) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    headers = event.get("headers") or {}
    auth = headers.get("authorization") or headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_current_user(event: dict) -> Optional[dict]:
    """Get the authenticated user from the request event."""
    token = extract_token(event)
    if not token:
        return None
    return decode_token(token)


def get_user_role(user: Optional[dict]) -> str:
    """Get the role string for a user, defaulting to empty string."""
    if not user:
        return ""
    return user.get("role", "")


def get_user_level(user: Optional[dict]) -> int:
    """Get the numeric privilege level for a user."""
    return ROLE_HIERARCHY.get(get_user_role(user), -1)


# ── Core permission check ─────────────────────────────────────────────────────

def require_role(user: Optional[dict], minimum_role: str) -> bool:
    """Return True if user has at least the minimum required role."""
    if not user:
        return False
    return get_user_level(user) >= ROLE_HIERARCHY.get(minimum_role, 99)


# ── Permission helpers ────────────────────────────────────────────────────────

def can_read(user: Optional[dict]) -> bool:
    """Viewer and above can read any resource."""
    return require_role(user, "viewer")


def can_write(user: Optional[dict]) -> bool:
    """Contributor and above can create and update records."""
    return require_role(user, "contributor")


def can_delete(user: Optional[dict]) -> bool:
    """Manager and above can delete records."""
    return require_role(user, "manager")


def can_admin(user: Optional[dict]) -> bool:
    """Only admins can manage users and system settings."""
    return require_role(user, "admin")


def can_manage_team(user: Optional[dict]) -> bool:
    """Manager and above can manage team structure."""
    return require_role(user, "manager")


def can_manage_members(user: Optional[dict]) -> bool:
    """Contributor and above can add/edit members."""
    return require_role(user, "contributor")


def can_manage_achievements(user: Optional[dict]) -> bool:
    """Contributor and above can record achievements."""
    return require_role(user, "contributor")


# ── Error message helpers ─────────────────────────────────────────────────────

def permission_error(required_role: str) -> dict:
    """
    Return a structured 403 error with a clear message about what role is needed.
    Used by handlers to give users actionable feedback.
    """
    desc = ROLE_DESCRIPTIONS.get(required_role, required_role)
    label = ROLE_LABELS.get(required_role, required_role.capitalize())
    return {
        "statusCode": 403,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": f'{{"error": "Access denied. {label} role required ({desc}).", "required_role": "{required_role}"}}',
    }


def auth_error() -> dict:
    """Return a structured 401 error for missing or invalid authentication."""
    return {
        "statusCode": 401,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": '{"error": "Authentication required. Please provide a valid Bearer token.", "code": "UNAUTHENTICATED"}',
    }


# ── Role info ─────────────────────────────────────────────────────────────────

def get_role_info(role: str) -> dict:
    """Return metadata about a role — useful for API responses."""
    return {
        "role":        role,
        "label":       ROLE_LABELS.get(role, role),
        "level":       ROLE_HIERARCHY.get(role, -1),
        "description": ROLE_DESCRIPTIONS.get(role, ""),
        "permissions": {
            "read":         True,
            "write":        ROLE_HIERARCHY.get(role, -1) >= ROLE_HIERARCHY["contributor"],
            "delete":       ROLE_HIERARCHY.get(role, -1) >= ROLE_HIERARCHY["manager"],
            "admin":        ROLE_HIERARCHY.get(role, -1) >= ROLE_HIERARCHY["admin"],
        }
    }
