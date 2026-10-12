from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRETS = {
    "",
    "supersecretkey",
    "supersecretkey_dev_testing_only",
    "your_jwt_secret_key_here",
    "supersecretkey_replace_for_production",
    "changeme",
    "secret"
}

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    MONGODB_URI: str = ""
    DATABASE_NAME: str = "mindmap_db"
    JWT_SECRET: str = "supersecretkey_dev_testing_only" # Explicit dev-only fallback
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self):
        env = (self.ENVIRONMENT or "").strip().lower()
        if env == "production":
            secret = (self.JWT_SECRET or "").strip()
            if not secret or secret in INSECURE_SECRETS:
                raise ValueError(
                    "Production startup rejected: Insecure, default, or placeholder JWT_SECRET is not permitted. "
                    "Provide a cryptographically random secret of at least 32 characters in JWT_SECRET."
                )
            if len(secret) < 32:
                raise ValueError(
                    "Production startup rejected: JWT_SECRET must be at least 32 characters long in production environment."
                )
        return self

settings = Settings()
