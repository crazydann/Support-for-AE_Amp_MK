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
SHEET_REPORT    = "Weekly Report"

INTEL_LOG_HEADERS = ["ts", "date", "type", "account", "summary", "source"]
MEMORY_HEADERS    = ["account", "date", "insight", "type", "source"]
REPORT_HEADERS    = ["key", "value", "updated_at"]


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


# ══════════════════════════════════════════════════════════════
# Weekly Report Sheets 백업/복원
# ══════════════════════════════════════════════════════════════

REPORT_FILE = DATA_DIR / "weekly_report.json"


def _compress_json(data: dict) -> str:
    """JSON → gzip 압축 → base64 인코딩 (Sheets 50K 셀 한계 우회)"""
    import gzip, base64
    raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9)
    return "gz:" + base64.b64encode(compressed).decode("ascii")


def _decompress_json(value: str) -> dict:
    """base64+gzip → dict 복원"""
    import gzip, base64
    if value.startswith("gz:"):
        compressed = base64.b64decode(value[3:])
        raw = gzip.decompress(compressed).decode("utf-8")
        return json.loads(raw)
    return json.loads(value)  # 구버전 평문 JSON 호환


def save_report_to_sheets(report: dict) -> bool:
    """
    weekly_report.json 전체를 Sheets 'Weekly Report' 탭에 백업.
    gzip 압축으로 50K 셀 한계 우회 (58K JSON → ~10K 압축).
    """
    try:
        ws = _get_worksheet(SHEET_REPORT, REPORT_HEADERS)
        if not ws:
            return False
        encoded = _compress_json(report)
        now = datetime.now(timezone.utc).isoformat()
        rows = ws.get_all_values()
        if len(rows) >= 2:
            ws.update("A2:C2", [["weekly_report", encoded, now]], value_input_option="RAW")
        else:
            ws.append_row(["weekly_report", encoded, now], value_input_option="RAW")
        logger.info(
            f"[Sheets] weekly_report 백업 완료 "
            f"({len(report.get('accounts', []))}개 계정, {len(encoded)}자 압축)"
        )
        return True
    except Exception as e:
        logger.warning(f"weekly_report Sheets 백업 실패: {e}")
        return False


def restore_report_from_sheets() -> dict | None:
    """Sheets 'Weekly Report' 탭에서 weekly_report.json 복원"""
    try:
        ws = _get_worksheet(SHEET_REPORT, REPORT_HEADERS)
        if not ws:
            return None
        rows = ws.get_all_values()
        for row in rows[1:]:
            if len(row) >= 2 and row[0] == "weekly_report" and row[1]:
                report = _decompress_json(row[1])
                logger.info(
                    f"[Sheets] weekly_report 복원 완료 "
                    f"({len(report.get('accounts', []))}개 계정, "
                    f"generated_at: {report.get('generated_at', '?')[:19]})"
                )
                return report
    except Exception as e:
        logger.warning(f"weekly_report Sheets 복원 실패: {e}")
    return None


def restore_intel_log_from_sheets() -> int:
    """Sheets 'Intel Log' 탭에서 intel_log.jsonl 복원. 복원된 항목 수 반환."""
    try:
        ws = _get_worksheet(SHEET_INTEL_LOG, INTEL_LOG_HEADERS)
        if not ws:
            return 0
        rows = ws.get_all_values()
        if len(rows) <= 1:  # 헤더만 있거나 빈 경우
            return 0
        DATA_DIR.mkdir(exist_ok=True)
        count = 0
        with open(INTEL_LOG_FILE, "w", encoding="utf-8") as f:
            for row in rows[1:]:  # 헤더 스킵
                if not row or not any(row):
                    continue
                entry = {
                    "ts":      row[0] if len(row) > 0 else "",
                    "date":    row[1] if len(row) > 1 else "",
                    "type":    row[2] if len(row) > 2 else "",
                    "account": row[3] if len(row) > 3 else "",
                    "summary": row[4] if len(row) > 4 else "",
                    "source":  row[5] if len(row) > 5 else "",
                }
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
                count += 1
        logger.info(f"[Sheets] intel_log 복원 완료 ({count}건)")
        return count
    except Exception as e:
        logger.warning(f"intel_log Sheets 복원 실패: {e}")
        return 0


async def restore_on_startup() -> dict:
    """
    서버 시작 시 Sheets에서 로컬 파일 복원.
    Sheets에 더 최신 데이터가 있으면 항상 복원 (30일 제한 없음).
    """
    loop = asyncio.get_event_loop()
    result = {"intel_log": 0, "weekly_report": False}

    # ── intel_log 복원 ────────────────────────────────────────
    local_count = 0
    if INTEL_LOG_FILE.exists():
        try:
            local_count = sum(1 for line in INTEL_LOG_FILE.read_text(encoding="utf-8").splitlines() if line.strip())
        except Exception:
            pass

    if local_count < 10:  # 로컬에 10건 미만이면 Sheets에서 복원
        count = await loop.run_in_executor(None, restore_intel_log_from_sheets)
        result["intel_log"] = count
        logger.info(f"[Startup] intel_log 복원: {count}건 (기존 로컬: {local_count}건)")
    else:
        logger.info(f"[Startup] intel_log 로컬 정상 ({local_count}건) — 복원 스킵")

    # ── weekly_report 복원: Sheets 데이터가 로컬보다 최신이면 항상 복원 ──
    local_generated_at = ""
    local_accounts = 0
    if REPORT_FILE.exists():
        try:
            local_data = json.loads(REPORT_FILE.read_text(encoding="utf-8"))
            local_generated_at = local_data.get("generated_at", "")
            local_accounts = len(local_data.get("accounts", []))
        except Exception:
            pass

    # Sheets에서 복원 시도
    restored = await loop.run_in_executor(None, restore_report_from_sheets)
    if restored:
        sheets_generated_at = restored.get("generated_at", "")
        sheets_accounts = len(restored.get("accounts", []))

        # Sheets 버전이 로컬보다 최신이거나, 로컬이 없거나 비어 있으면 복원
        should_restore = (
            not local_generated_at          # 로컬에 타임스탬프 없음
            or not local_accounts           # 로컬에 계정 없음
            or sheets_generated_at > local_generated_at   # Sheets가 더 최신
        )

        if should_restore:
            REPORT_FILE.write_text(json.dumps(restored, ensure_ascii=False, indent=2), encoding="utf-8")
            result["weekly_report"] = True
            logger.info(
                f"[Startup] weekly_report Sheets 복원 완료 "
                f"({sheets_accounts}개 계정, {sheets_generated_at}) "
                f"← 로컬 ({local_accounts}개 계정, {local_generated_at})"
            )
        else:
            logger.info(
                f"[Startup] weekly_report 로컬이 최신 ({local_generated_at}) "
                f"> Sheets ({sheets_generated_at}) — 로컬 유지"
            )
    else:
        if not local_generated_at:
            logger.warning("[Startup] weekly_report: Sheets 백업 없음 + 로컬도 없음")
        else:
            logger.info(f"[Startup] weekly_report Sheets 백업 없음 — 로컬 유지 ({local_generated_at})")

    return result
