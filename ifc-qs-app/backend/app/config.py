from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    upload_dir: str = "/app/uploads"
    max_file_size_mb: int = 200
    cors_origins: str = "http://localhost:3000"

    # Auth — override these in .env for production
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    access_token_expire_hours: int = 8
    # Seed admin credentials (used only when no users.json exists yet)
    admin_username: str = "admin"
    admin_password: str = "changeme"

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env"}


settings = Settings()
