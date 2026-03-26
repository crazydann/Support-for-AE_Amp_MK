from functools import lru_cache
from .config import Settings
from .services.dart_service import DartService
from .services.search_service import SearchService
from .services.ai_service import AIService
from .services.blueprint_service import BlueprintService


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def get_blueprint_service() -> BlueprintService:
    settings = get_settings()
    dart = DartService(api_key=settings.dart_api_key)
    search = SearchService(serpapi_key=settings.serpapi_key or None)
    ai = AIService(api_key=settings.anthropic_api_key)
    return BlueprintService(dart_service=dart, search_service=search, ai_service=ai)
