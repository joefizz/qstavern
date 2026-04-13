from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import health, files

app = FastAPI(title="IFC Quantity Surveying API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(files.router, prefix="/api")

# Ensure upload directory exists at startup
@app.on_event("startup")
async def startup():
    settings.upload_path.mkdir(parents=True, exist_ok=True)
