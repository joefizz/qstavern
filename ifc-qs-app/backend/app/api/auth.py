"""Authentication endpoints: login, logout, user management (admin only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.security import create_access_token, decode_access_token
from app.services import user_store

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserIn(BaseModel):
    username: str
    password: str
    role: str = "user"


class PasswordChange(BaseModel):
    new_password: str


# ── Dependency ────────────────────────────────────────────────────────────────

def _get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return ""


def get_current_user(request: Request) -> dict:
    username = decode_access_token(_get_token(request))
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = user_store.get_user(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = user_store.authenticate(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user["username"])
    return TokenResponse(access_token=token)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"username": user["username"], "role": user["role"]}


# ── User management (admin only) ──────────────────────────────────────────────

@router.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    return user_store.list_users()


@router.post("/users", status_code=201)
async def create_user(body: UserIn, admin: dict = Depends(require_admin)):
    try:
        return user_store.create_user(body.username, body.password, body.role)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/users/{username}", status_code=204)
async def delete_user(username: str, admin: dict = Depends(require_admin)):
    if username == admin["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not user_store.delete_user(username):
        raise HTTPException(status_code=404, detail="User not found")


@router.post("/users/{username}/password", status_code=204)
async def change_password(
    username: str,
    body: PasswordChange,
    admin: dict = Depends(require_admin),
):
    if not user_store.change_password(username, body.new_password):
        raise HTTPException(status_code=404, detail="User not found")
