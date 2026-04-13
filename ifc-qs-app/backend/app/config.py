from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    upload_dir: str = "/app/uploads"
    max_file_size_mb: int = 200
    cors_origins: str = "http://localhost:3000"

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env"}


settings = Settings()
