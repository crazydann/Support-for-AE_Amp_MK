from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import Settings
from .routers import company

settings = Settings()

app = FastAPI(
    title="AE Automation Service",
    description="Amplitude AE를 위한 고객사 인텔리전스 플랫폼",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(company.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "AE Automation Service"}
