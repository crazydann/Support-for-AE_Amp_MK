from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import Settings
from .routers import company, intel, auth

settings = Settings()

# ── 스케줄러 초기화 ────────────────────────────────────────────────────────────
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _SCHEDULER_AVAILABLE = True
except ImportError:
    _scheduler = None
    _SCHEDULER_AVAILABLE = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── 앱 시작 ──
    if _SCHEDULER_AVAILABLE and _scheduler:
        from .services.scheduler import daily_update_job
        # 매일 오전 5시 KST = UTC 20:00
        _scheduler.add_job(
            daily_update_job,
            CronTrigger(hour=20, minute=0, timezone="UTC"),
            id="daily_update",
            replace_existing=True,
            misfire_grace_time=3600,  # 1시간 내 missed job 실행
        )
        _scheduler.start()
        import logging
        logging.getLogger(__name__).info(
            "[Scheduler] Started — daily update at 05:00 KST (20:00 UTC)"
        )
    yield
    # ── 앱 종료 ──
    if _SCHEDULER_AVAILABLE and _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


app = FastAPI(
    title="AE Automation Service",
    description="Amplitude AE를 위한 고객사 인텔리전스 플랫폼",
    version="1.0.0",
    lifespan=lifespan,
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
    scheduler_info = {}
    if _SCHEDULER_AVAILABLE and _scheduler:
        jobs = _scheduler.get_jobs()
        scheduler_info = {
            "running": _scheduler.running,
            "jobs": [
                {
                    "id": j.id,
                    "next_run_kst": (
                        j.next_run_time.astimezone(
                            __import__("datetime").timezone(
                                __import__("datetime").timedelta(hours=9)
                            )
                        ).strftime("%Y-%m-%d %H:%M KST")
                        if j.next_run_time else None
                    ),
                }
                for j in jobs
            ],
        }
    return {"status": "ok", "service": "AE Automation Service", "scheduler": scheduler_info}


@app.post("/api/intel/scheduler/run-now")
@app.get("/api/intel/scheduler/run-now")
async def run_scheduler_now():
    """스케줄러 수동 즉시 실행 (테스트/긴급 업데이트용) - GET/POST 모두 지원"""
    import asyncio as _asyncio
    from .services.scheduler import daily_update_job
    _asyncio.create_task(daily_update_job())
    return {"ok": True, "message": "Daily update job triggered (running in background)"}


# 프론트엔드 정적 파일 서빙
_root = Path(__file__).parent.parent
STATIC_DIR = _root / "public" if (_root / "public").exists() else _root / "frontend" / "dist"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(STATIC_DIR / "index.html")
