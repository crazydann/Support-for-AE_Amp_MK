"""
Google Sheets 서비스 - Amplitude 고객 데이터 읽기

1차: 공개 CSV export URL (Google Sheet 공개 설정 시)
2차 fallback: 로컬 JSON 캐시 (backend/data/korea_accounts.json)
"""
import csv
import io
import json
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1E2exrgcAu9Nt17a0MAfWWJZelqc5UbeC4aez8R86BHQ"
    "/export?format=csv&gid=1244218108"
)
KOREA_REGION = "APJ - RoAsia - Korea"
CACHE_TTL = timedelta(hours=1)
LOCAL_CACHE_PATH = Path(__file__).parent.parent / "data" / "korea_accounts.json"

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# 인메모리 캐시
_cache: dict[str, dict] = {}
_cache_time: Optional[datetime] = None


class SheetsService:
    async def fetch_korea_accounts(self) -> dict[str, dict]:
        """Korea 계정 데이터 반환 (캐시 → 공개 CSV → 로컬 JSON 순서)"""
        global _cache, _cache_time

        now = datetime.now()
        if _cache and _cache_time and (now - _cache_time) < CACHE_TTL:
            return _cache

        # 1. 공개 CSV URL 시도
        accounts = await self._fetch_from_csv()
        if accounts:
            _cache = accounts
            _cache_time = now
            logger.info(f"Google Sheets CSV에서 {len(accounts)}개 Korea 계정 로드")
            return _cache

        # 2. 로컬 JSON 캐시 fallback
        accounts = self._load_local_cache()
        if accounts:
            _cache = accounts
            _cache_time = now
            logger.info(f"로컬 캐시에서 {len(accounts)}개 Korea 계정 로드")
            return _cache

        logger.warning("Korea 계정 데이터를 로드할 수 없습니다")
        return {}

    async def _fetch_from_csv(self) -> dict[str, dict]:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(SHEET_CSV_URL)
                resp.raise_for_status()
            return _parse_csv(resp.text)
        except Exception as e:
            logger.debug(f"CSV 로드 실패 (로컬 캐시로 fallback): {e}")
            return {}

    def _load_local_cache(self) -> dict[str, dict]:
        try:
            if not LOCAL_CACHE_PATH.exists():
                return {}
            with open(LOCAL_CACHE_PATH, encoding="utf-8") as f:
                data = json.load(f)
            accounts = {a["account_name"]: a for a in data.get("accounts", [])}
            logger.info(
                f"로컬 캐시 로드: {data.get('last_updated', '?')} 기준 "
                f"{len(accounts)}개 계정"
            )
            return accounts
        except Exception as e:
            logger.warning(f"로컬 캐시 로드 실패: {e}")
            return {}

    def find_account(self, accounts: dict[str, dict], company_name: str) -> Optional[dict]:
        """회사명으로 계정 찾기 (퍼지 매칭)"""
        if not accounts:
            return None

        # 1. 정확히 일치
        if company_name in accounts:
            return accounts[company_name]

        # 2. 영문/공백 무시 부분 일치
        c = _normalize(company_name)
        for name, data in accounts.items():
            n = _normalize(name)
            if c and n and (c in n or n in c) and len(c) >= 3:
                return data

        return None

    def to_amplitude_fields(self, account: dict) -> dict:
        """계정 데이터를 blueprint Amplitude 필드로 변환"""
        plan = account.get("plan", "")
        plan_normalized = _normalize_plan(plan)

        note_parts = []
        arr = account.get("arr", "")
        if arr and _is_numeric(arr):
            note_parts.append(f"ARR: ${arr}")
        health = account.get("health", "")
        if health and health not in ("Unknown", "0", ""):
            note_parts.append(f"Health: {health}")
        sentiment = account.get("csm_sentiment", "")
        if sentiment and sentiment not in ("Unknown", ""):
            note_parts.append(f"Sentiment: {sentiment}")
        active_users = account.get("active_users_4wk", "")
        if active_users and active_users.strip() not in ("0", ""):
            note_parts.append(f"Active Users (4wk): {active_users.strip()}")
        owner = account.get("account_owner", "")
        if owner:
            note_parts.append(f"AE: {owner}")
        sub_start = account.get("subscription_start", "")
        if sub_start:
            note_parts.append(f"도입: {sub_start[:10]}")

        return {
            "amplitude_status": "active",
            "amplitude_plan": plan_normalized,
            "amplitude_note": " · ".join(note_parts) if note_parts else "Amplitude 고객사",
        }


# ─── 파싱 헬퍼 ─────────────────────────────────────────────────────────────

def _parse_csv(text: str) -> dict[str, dict]:
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if len(rows) < 2:
        return {}

    accounts: dict[str, dict] = {}
    for row in rows[1:]:  # row 0 = "Data as of ..." or headers
        if len(row) < 5:
            continue

        # 헤더 행 건너뛰기
        if row[0].strip() in ("Quarter", "# Data as of 2024-01-02"):
            continue

        # Region 동적 탐지
        region_idx = -1
        for i, val in enumerate(row):
            if "APJ" in val:
                region_idx = i
                break
        if region_idx < 0:
            continue

        region = row[region_idx].strip()
        if KOREA_REGION not in region:
            continue

        name = row[5].strip() if len(row) > 5 else ""
        if not name or name.startswith("<"):
            continue

        owner_idx = region_idx - 1
        owner = row[owner_idx].strip() if owner_idx >= 0 and len(row) > owner_idx else ""

        def safe(idx: int) -> str:
            return row[idx].strip() if len(row) > idx else ""

        arr = _normalize_arr(safe(6)) or _normalize_arr(safe(7))
        plan = _normalize_plan_raw(safe(10)) or _normalize_plan_raw(safe(11))

        accounts[name] = {
            "account_name": name,
            "arr": arr,
            "subscription_start": safe(8),
            "subscription_end": safe(9),
            "plan": plan or "",
            "product_usage_score": safe(14),
            "csm_sentiment": safe(15),
            "health": safe(16),
            "active_users_4wk": safe(19),
            "analytics_arr": _normalize_arr(safe(23)),
            "experiment_arr": _normalize_arr(safe(24)),
            "account_owner": owner,
            "region": region,
        }

    return accounts


def _normalize(name: str) -> str:
    return name.lower().replace(" ", "").replace(",", "").replace(".", "").replace("-", "")


def _normalize_plan(plan: str) -> Optional[str]:
    if not plan:
        return None
    p = plan.lower()
    if "enterprise" in p:
        return "Enterprise"
    if "growth" in p:
        return "Growth"
    if "starter" in p:
        return "Starter"
    if "event volume" in p or p == "event volume":
        return "Event Volume"
    if "monthly tracked" in p or p == "mtu":
        return "MTU"
    if p in ("year", "month", "6 months", "3 months"):
        return plan
    return plan or None


def _normalize_plan_raw(val: str) -> str:
    """서비스 내부 파싱용 plan 정규화 (날짜/슬러그 제외)"""
    if not val:
        return ""
    if DATE_PATTERN.match(val.strip()):
        return ""
    v = val.lower().strip()
    if "enterprise" in v:
        return "Enterprise"
    if "growth" in v:
        return "Growth"
    if "starter" in v:
        return "Starter"
    if "event volume" in v:
        return "Event Volume"
    if "monthly tracked" in v:
        return "MTU"
    if v in ("year", "month", "6 months", "3 months", "scale"):
        return val.strip()
    if "/" in val or re.match(r"^[a-z].*-[a-z]", val.lower()):
        return ""
    return val.strip()


def _normalize_arr(val: str) -> str:
    if not val:
        return ""
    clean = val.replace(",", "").strip()
    if clean.lstrip("-").isdigit():
        return val.strip()
    return ""


def _is_numeric(val: str) -> bool:
    return bool(val and val.replace(",", "").strip().lstrip("-").isdigit())
