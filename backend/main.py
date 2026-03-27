from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import Settings
from .routers import company, intel

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

app.include_router(company.router)
app.include_router(intel.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "AE Automation Service"}


# 프론트엔드 정적 파일 서빙 (public/ 우선, 없으면 frontend/dist/ fallback)
_root = Path(__file__).parent.parent
STATIC_DIR = _root / "public" if (_root / "public").exists() else _root / "frontend" / "dist"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(STATIC_DIR / "index.html")
