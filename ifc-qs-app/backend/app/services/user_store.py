"""Persist user accounts to {upload_dir}/users.json.

File format:
  [{"username": "admin", "hashed_password": "$2b$...", "role": "admin"}, ...]

On first startup the seed admin from settings is written automatically.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from app.config import settings
from app.core.security import hash_password, verify_password


def _users_path() -> Path:
    return settings.upload_path / "users.json"


def _load() -> list[dict]:
    path = _users_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save(users: list[dict]) -> None:
    _users_path().write_text(json.dumps(users, indent=2), encoding="utf-8")


# ── Public API ────────────────────────────────────────────────────────────────

def seed_admin() -> None:
    """Create the default admin if no users exist, or sync the password if it changed in .env."""
    users = _load()
    if not users:
        _save([{
            "username": settings.admin_username,
            "hashed_password": hash_password(settings.admin_password),
            "role": "admin",
        }])
        return

    # If the env admin already exists but the password no longer matches, update it.
    # This lets you change ADMIN_PASSWORD in .env and restart to take effect.
    changed = False
    for user in users:
        if user["username"] == settings.admin_username:
            if not verify_password(settings.admin_password, user["hashed_password"]):
                user["hashed_password"] = hash_password(settings.admin_password)
                changed = True
            break
    if changed:
        _save(users)


def authenticate(username: str, password: str) -> Optional[dict]:
    """Return the user record if credentials are valid, else None."""
    for user in _load():
        if user["username"] == username and verify_password(
            password, user["hashed_password"]
        ):
            return user
    return None


def get_user(username: str) -> Optional[dict]:
    for user in _load():
        if user["username"] == username:
            return user
    return None


def list_users() -> list[dict]:
    return [{"username": u["username"], "role": u["role"]} for u in _load()]


def create_user(username: str, password: str, role: str = "user") -> dict:
    users = _load()
    if any(u["username"] == username for u in users):
        raise ValueError(f"Username '{username}' already exists")
    record = {
        "username": username,
        "hashed_password": hash_password(password),
        "role": role,
    }
    users.append(record)
    _save(users)
    return {"username": username, "role": role}


def delete_user(username: str) -> bool:
    users = _load()
    new_users = [u for u in users if u["username"] != username]
    if len(new_users) == len(users):
        return False
    _save(new_users)
    return True


def change_password(username: str, new_password: str) -> bool:
    users = _load()
    for user in users:
        if user["username"] == username:
            user["hashed_password"] = hash_password(new_password)
            _save(users)
            return True
    return False
