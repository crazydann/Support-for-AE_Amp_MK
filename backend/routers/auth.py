"""
Google OAuth 인증 + 허용 목록 기반 접근 제어
"""
import json
import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

DATA_DIR = Path(__file__).parent.parent / "data"
USERS_FILE = DATA_DIR / "allowed_users.json"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30
COOKIE_NAME = "ae_session"


# ── 허용 목록 헬퍼 ────────────────────────────────────────────────────────────

def _read_users() -> list[str]:
    if not USERS_FILE.exists():
        return []
    try:
        return json.loads(USERS_FILE.read_text())["users"]
    except Exception:
        return []


def _write_users(users: list[str]):
    USERS_FILE.write_text(
        json.dumps({"users": users}, ensure_ascii=False, indent=2)
    )


# ── JWT 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_secret() -> str:
    from ..config import Settings
    return Settings().jwt_secret_key


def _create_token(email: str, name: str, picture: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": email, "name": name, "picture": picture, "exp": expire},
        _get_secret(), algorithm=ALGORITHM,
    )


def _verify_token(token: str) -> dict:
    return jwt.decode(token, _get_secret(), algorithms=[ALGORITHM])


def _get_settings():
    from ..config import Settings
    return Settings()


# ── 현재 사용자 추출 (다른 라우터에서 import하여 사용) ──────────────────────────

def get_current_user(request: Request) -> dict | None:
    """쿠키에서 JWT를 검증하고 사용자 정보 반환. 없으면 None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        return _verify_token(token)
    except JWTError:
        return None


def require_user(request: Request) -> dict:
    """인증 필수. 미인증 시 401."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_admin(request: Request) -> dict:
    """관리자만 허용."""
    user = require_user(request)
    settings = _get_settings()
    if user["sub"] != settings.admin_email:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ── OAuth 엔드포인트 ─────────────────────────────────────────────────────────

@router.get("/login")
async def login(request: Request):
    """Google OAuth 로그인 시작."""
    settings = _get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{settings.app_url}/api/auth/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "state": secrets.token_urlsafe(16),
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/callback")
async def callback(code: str, request: Request, response: Response):
    """Google OAuth 콜백 처리."""
    settings = _get_settings()

    # 1) code → token 교환
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": f"{settings.app_url}/api/auth/callback",
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code")
        tokens = token_res.json()

        # 2) 사용자 정보 조회
        user_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        user_info = user_res.json()

    email = user_info.get("email", "")
    name = user_info.get("name", email)
    picture = user_info.get("picture", "")

    # 3) @amplitude.com 도메인 확인
    if not email.endswith("@amplitude.com"):
        return RedirectResponse(f"{settings.app_url}/?auth_error=domain")

    # 4) 허용 목록 확인 (admin은 항상 통과)
    allowed = _read_users()
    if email != settings.admin_email and email not in allowed:
        return RedirectResponse(f"{settings.app_url}/?auth_error=not_allowed")

    # 5) 첫 admin 자동 등록 (admin_email이 비어 있으면 최초 로그인 사용자가 admin)
    # admin_email 설정된 경우에만 체크하므로 별도 처리 불필요

    # 6) JWT 발급 후 쿠키 설정
    jwt_token = _create_token(email, name, picture)
    redirect = RedirectResponse(url="/", status_code=302)
    redirect.set_cookie(
        key=COOKIE_NAME,
        value=jwt_token,
        httponly=True,
        secure=settings.app_url.startswith("https"),
        samesite="lax",
        max_age=60 * 60 * 24 * TOKEN_EXPIRE_DAYS,
        path="/",
    )
    return redirect


@router.get("/me")
async def me(request: Request):
    """현재 로그인 사용자 반환."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    settings = _get_settings()
    return {
        "email": user["sub"],
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
        "is_admin": user["sub"] == settings.admin_email,
    }


@router.post("/logout")
async def logout():
    """로그아웃 — 쿠키 삭제."""
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


# ── 사용자 관리 (admin only) ──────────────────────────────────────────────────

class AddUserRequest(BaseModel):
    email: str


@router.get("/users")
async def list_users(request: Request):
    """허용 목록 조회 (admin only)."""
    require_admin(request)
    settings = _get_settings()
    users = _read_users()
    return {
        "admin": settings.admin_email,
        "users": users,
    }


@router.post("/users")
async def add_user(body: AddUserRequest, request: Request):
    """사용자 추가 (admin only)."""
    require_admin(request)
    email = body.email.strip().lower()
    if not email.endswith("@amplitude.com"):
        raise HTTPException(status_code=400, detail="@amplitude.com 이메일만 허용됩니다")
    users = _read_users()
    if email not in users:
        users.append(email)
        _write_users(users)
    return {"ok": True, "users": users}


@router.delete("/users/{email:path}")
async def remove_user(email: str, request: Request):
    """사용자 제거 (admin only)."""
    admin = require_admin(request)
    if email == admin["sub"]:
        raise HTTPException(status_code=400, detail="자기 자신은 제거할 수 없습니다")
    users = _read_users()
    users = [u for u in users if u != email]
    _write_users(users)
    return {"ok": True, "users": users}
