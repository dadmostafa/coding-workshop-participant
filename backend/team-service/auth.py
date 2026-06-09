import os
import jwt
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "acme-super-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8
ROLE_HIERARCHY = {"viewer": 0, "contributor": 1, "manager": 2, "admin": 3}

def hash_password(plain: str) -> str:
    salt = os.urandom(32).hex()
    hashed = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260000).hex()
    return f"{salt}:{hashed}"

def verify_password(plain: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(":")
        check = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260000).hex()
        return hmac.compare_digest(check, hashed)
    except Exception:
        return False

def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id, "username": username, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

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
    return decode_token(token)

def require_role(user: Optional[dict], minimum_role: str) -> bool:
    if not user:
        return False
    user_level = ROLE_HIERARCHY.get(user.get("role", ""), -1)
    required_level = ROLE_HIERARCHY.get(minimum_role, 99)
    return user_level >= required_level

def can_read(user):   return require_role(user, "viewer")
def can_write(user):  return require_role(user, "contributor")
def can_delete(user): return require_role(user, "manager")
def can_admin(user):  return require_role(user, "admin")
