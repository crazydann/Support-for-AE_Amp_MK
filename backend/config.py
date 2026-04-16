import secrets as _secrets
from pydantic_settings import BaseSettings
from pydantic import field_validator
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

    # 팀 설정
    team_name: str = "Amplitude Korea AE"   # 팀 이름 (UI 표시용)

    # 서버 설정
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["*"]

    @field_validator("jwt_secret_key")
    @classmethod
    def secure_jwt_secret(cls, v: str) -> str:
        """기본값이 그대로이면 안전한 랜덤 키로 교체."""
        if v == "change-me-in-production-use-random-string":
            import logging
            logging.getLogger(__name__).warning(
                "[Security] JWT_SECRET_KEY 미설정 — 랜덤 키 사용 (재시작 시 세션 무효화됨). "
                "환경변수 JWT_SECRET_KEY를 설정하세요."
            )
            return _secrets.token_hex(32)
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
