from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # 필수 API 키
    dart_api_key: str = ""
    anthropic_api_key: str = ""

    # 선택 API 키
    serpapi_key: Optional[str] = None

    # Google OAuth (Google Cloud Console에서 발급)
    google_client_id: str = ""
    google_client_secret: str = ""
    app_url: str = "http://localhost:8000"   # Render 배포 시: https://your-app.onrender.com
    jwt_secret_key: str = "change-me-in-production-use-random-string"
    admin_email: str = ""                    # 권한 관리자 이메일 (MK 본인)

    # 서버 설정
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
