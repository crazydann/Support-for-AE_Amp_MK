"""
Intel Memory Service
====================
두 가지 영구 메모리 레이어 관리:

Layer 1: intel_log.jsonl  (append-only 원시 로그)
  - 메모 저장, Gmail/Slack 싱크, Claude 인사이트 등 모든 이벤트 누적
  - 삭제하지 않음, 항상 추가만

Layer 2: account_memory.json  (계정별 합성 요약)
  - Claude가 intel_log를 읽고 계정별로 요약/합성
  - 영업전략·할일 생성 시 참조

Google Sheets 미러:
  - 같은 Spreadsheet(NOTES_SPREADSHEET_ID)의 "Intel Log" / "Account Memory" 탭
  - 사람이 직접 편집·검토 가능
"""
import json
import logging
import os
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
INTEL_LOG_FILE  = DATA_DIR / "intel_log.jsonl"
MEMORY_FILE     = DATA_DIR / "account_memory.json"

# ── Sheets 탭 이름 ──────────────────────────────────────────
SHEET_INTEL_LOG = "Intel Log"
SHEET_MEMORY    = "Account Memory"

INTEL_LOG_HEADERS = ["ts", "date", "type", "account", "summary", "source"]
MEMORY_HEADERS    = ["account", "date", "insight", "type", "source"]


# ══════════════════════════════════════════════════════════════
# 내부 헬퍼 - Google Sheets
# ══════════════════════════════════════════════════════════════

def _get_sheet_client():
    sa_json_str = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json_str:
        return None
    try:
        import gspread
        from google.oauth2.service_account import Credentials
        sa_info = json.loads(sa_json_str)
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]
        creds = Credentials.from_service_account_info(sa_info, scopes=scopes)
        return gspread.authorize(creds)
    except Exception as e:
        logger.warning(f"Sheets 클라이언트 초기화 실패: {e}")
        return None


def _get_worksheet(sheet_name: str, headers: list[str]):
    """워크시트 반환. 없으면 자동 생성 + 헤더."""
    spreadsheet_id = os.environ.get("NOTES_SPREADSHEET_ID", "")
    if not spreadsheet_id:
        return None
    client = _get_sheet_client()
    if not client:
        return None
    try:
        sh = client.open_by_key(spreadsheet_id)
        try:
            ws = sh.worksheet(sheet_name)
        except Exception:
            ws = sh.add_worksheet(title=sheet_name, rows=5000, cols=len(headers))
            ws.append_row(headers)
            logger.info(f"Google Sheets '{sheet_name}' 탭 자동 생성")
        return ws
    except Exception as e:
        logger.warning(f"Sheets '{sheet_name}' 접근 실패: {e}")
        return None


# ══════════════════════════════════════════════════════════════
# Layer 1: Intel Log (append-only 원시 로그)
# ══════════════════════════════════════════════════════════════

def _sync_append_log(entry: dict) -> bool:
    """intel_log.jsonl에 한 줄 추가 + Sheets 미러"""
    try:
        DATA_DIR.mkdir(exist_ok=True)
        with open(INTEL_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.error(f"intel_log.jsonl 쓰기 실패: {e}")
        return False

    # Sheets 미러
    try:
        ws = _get_worksheet(SHEET_INTEL_LOG, INTEL_LOG_HEADERS)
        if ws:
            row = [
                entry.get("ts", ""),
                entry.get("date", ""),
                entry.get("type", ""),
                entry.get("account", "") or "",
                entry.get("summary", ""),
                entry.get("source", ""),
            ]
            ws.append_row(row, value_input_option="RAW")
    except Exception as e:
        logger.warning(f"Intel Log Sheets 미러 실패 (로컬엔 저장됨): {e}")

    return True


def _sync_read_log(account: Optional[str] = None, days: int = 90) -> list[dict]:
    """intel_log.jsonl 읽기. account/days 필터 지원."""
    if not INTEL_LOG_FILE.exists():
        return []
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    entries = []
    try:
        with open(INTEL_LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                    if e.get("date", "") < cutoff:
                        continue
                    if account and e.get("account") != account:
                        continue
                    entries.append(e)
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"intel_log.jsonl 읽기 실패: {e}")
    return sorted(entries, key=lambda x: x.get("ts", ""), reverse=True)


# ══════════════════════════════════════════════════════════════
# Layer 2: Account Memory (합성 요약)
# ══════════════════════════════════════════════════════════════

def _read_memory_sync() -> dict:
    if not MEMORY_FILE.exists():
        return {}
    try:
        return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _sync_append_memory(account: str, insight: str,
                         insight_type: str = "synthesis",
                         source: str = "claude") -> bool:
    """account_memory.json에 인사이트 추가 + Sheets 미러"""
    memory = _read_memory_sync()
    if account not in memory:
        memory[account] = []
    now = datetime.now(timezone.utc)
    entry = {
        "date":   now.strftime("%Y-%m-%d"),
        "ts":     now.isoformat(),
        "insight": insight,
        "type":   insight_type,
        "source": source,
    }
    memory[account].append(entry)

    try:
        MEMORY_FILE.write_text(
            json.dumps(memory, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    except Exception as e:
        logger.error(f"account_memory.json 쓰기 실패: {e}")
        return False

    # Sheets 미러
    try:
        ws = _get_worksheet(SHEET_MEMORY, MEMORY_HEADERS)
        if ws:
            row = [account, entry["date"], insight, insight_type, source]
            ws.append_row(row, value_input_option="RAW")
    except Exception as e:
        logger.warning(f"Account Memory Sheets 미러 실패 (로컬엔 저장됨): {e}")

    return True


# ══════════════════════════════════════════════════════════════
# 비동기 퍼블릭 API
# ══════════════════════════════════════════════════════════════

async def append_log(
    summary: str,
    log_type: str = "memo",
    account: Optional[str] = None,
    source: str = "user",
) -> bool:
    """
    Intel Log에 이벤트 추가.

    log_type: memo | gmail | slack | sync | insight | strategy
    source:   user | gmail | slack | claude | system
    """
    now = datetime.now(timezone.utc)
    entry = {
        "ts":      now.isoformat(),
        "date":    now.strftime("%Y-%m-%d"),
        "type":    log_type,
        "account": account or "",
        "summary": summary,
        "source":  source,
    }
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_append_log, entry)


async def read_log(account: Optional[str] = None, days: int = 90) -> list[dict]:
    """Intel Log 읽기."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_read_log, account, days)


async def read_memory(account: Optional[str] = None) -> dict:
    """Account Memory 읽기. account 지정 시 해당 계정만."""
    loop = asyncio.get_event_loop()
    memory = await loop.run_in_executor(None, _read_memory_sync)
    if account:
        return {account: memory.get(account, [])}
    return memory


async def append_memory(
    account: str,
    insight: str,
    insight_type: str = "synthesis",
    source: str = "claude",
) -> bool:
    """Account Memory에 인사이트 추가."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _sync_append_memory, account, insight, insight_type, source
    )


def is_available() -> bool:
    return bool(
        os.environ.get("NOTES_SPREADSHEET_ID")
        and os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    )
