from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import Settings
from .routers import company, intel, auth

settings = Settings()

app = FastAPI(
    title="AE Automation Service",
    description="Amplitude AE를 위한 고객사 인텔리전스 플랫폼",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 인증 미들웨어 ─────────────────────────────────────────────────────────────
# Google OAuth가 설정된 경우에만 보호 활성화
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Google OAuth 미설정 시 보호 비활성화 (개발 환경)
    if not settings.google_client_id:
        return await call_next(request)

    path = request.url.path

    # 인증 없이 허용할 경로
    PUBLIC_PATHS = ["/api/auth/", "/health", "/assets/", "/favicon"]
    if any(path.startswith(p) for p in PUBLIC_PATHS):
        return await call_next(request)

    # API 요청 → 401 JSON
    if path.startswith("/api/"):
        from .routers.auth import get_current_user
        user = get_current_user(request)
        if not user:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

    return await call_next(request)


app.include_router(auth.router)
app.include_router(company.router)
app.include_router(intel.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "AE Automation Service"}


# 프론트엔드 정적 파일 서빙
_root = Path(__file__).parent.parent
STATIC_DIR = _root / "public" if (_root / "public").exists() else _root / "frontend" / "dist"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(STATIC_DIR / "index.html")
