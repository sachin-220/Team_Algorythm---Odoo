import os
import secrets
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or workspace root
backend_env = Path(__file__).resolve().parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(backend_env)
if root_env.exists():
    load_dotenv(root_env)

class Settings:
    PROJECT_NAME: str = "StockSense Core Inventory Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "3306")
    DB_NAME: str = os.getenv("DB_NAME", "stocksense")
    
    @property
    def DATABASE_URL(self) -> str:
        if self.DB_PASSWORD:
            return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        return f"mysql+pymysql://{self.DB_USER}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"

    # Security & JWT
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # SMTP Configuration (Real Gmail SMTP Delivery)
    @property
    def SMTP_HOST(self) -> str:
        return os.getenv("SMTP_HOST", "smtp.gmail.com")

    @property
    def SMTP_PORT(self) -> int:
        try:
            return int(os.getenv("SMTP_PORT", "587"))
        except (ValueError, TypeError):
            return 587

    @property
    def SMTP_USERNAME(self) -> str:
        return os.getenv("SMTP_USERNAME", "sachinj2503@gmail.com")

    @property
    def SMTP_PASSWORD(self) -> str:
        return os.getenv("SMTP_PASSWORD", "")

    @property
    def SMTP_FROM(self) -> str:
        return os.getenv("SMTP_FROM", os.getenv("SMTP_USERNAME", "sachinj2503@gmail.com"))

    def get_jwt_secret(self) -> str:
        secret = os.getenv("JWT_SECRET_KEY")
        if secret:
            return secret
        secret_file = os.path.join(os.path.dirname(__file__), "..", "jwt_secret.txt")
        if os.path.exists(secret_file):
            try:
                with open(secret_file, "r") as f:
                    s = f.read().strip()
                    if s:
                        return s
            except Exception:
                pass
        
        # Generate and save ephemeral secret key
        ephemeral = secrets.token_hex(32)
        try:
            with open(secret_file, "w") as f:
                f.write(ephemeral)
        except Exception:
            logging.warning("Could not persist JWT secret key to file. Using in-memory ephemeral key.")
        return ephemeral

settings = Settings()
