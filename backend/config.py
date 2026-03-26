from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # 필수 API 키
    dart_api_key: str = ""          # DART OpenAPI 키 (dart.fss.or.kr 무료 발급)
    anthropic_api_key: str = ""     # Claude API 키

    # 선택 API 키
    serpapi_key: Optional[str] = None  # SerpAPI (없으면 네이버 검색 사용)

    # 서버 설정
    host: str = "0.0.0.0"
    port: int = 8000  # Railway는 $PORT 환경변수로 자동 override
    cors_origins: list[str] = ["*"]  # 배포 환경에서 전체 허용

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
