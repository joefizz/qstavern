"""JWT creation/verification and password hashing."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

ALGORITHM = "HS256"

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passwords ─────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Tokens ────────────────────────────────────────────────────────────────────

def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.access_token_expire_hours
    )
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """Return the username embedded in *token*, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
