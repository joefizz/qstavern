from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api import health, files, auth
from app.core.security import decode_access_token

app = FastAPI(title="IFC Quantity Surveying API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth middleware ───────────────────────────────────────────────────────────
# Protects every /api/* route except /api/auth/*

_PUBLIC_PREFIXES = ("/api/auth/", "/health")

@app.middleware("http")
async def require_auth(request: Request, call_next):
    path = request.url.path
    if any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return await call_next(request)
    if path.startswith("/api/"):
        # Primary: Authorization header (all regular requests)
        token = request.headers.get("Authorization", "")
        if token.startswith("Bearer "):
            token = token[7:]
        # Fallback: ?token= query param (for EventSource/SSE which can't send headers)
        if not token:
            token = request.query_params.get("token", "")
        if not decode_access_token(token):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
    return await call_next(request)


app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(files.router, prefix="/api")


@app.on_event("startup")
async def startup():
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    # Seed default admin user if no users exist yet
    from app.services import user_store
    user_store.seed_admin()
