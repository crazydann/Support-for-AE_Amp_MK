"""
Google Sheets 기반 메모 저장소
Render 재배포 후에도 데이터 영구 보존.

필요한 환경변수:
  - GOOGLE_SERVICE_ACCOUNT_JSON : Service Account 인증 (기존과 동일)
  - NOTES_SPREADSHEET_ID        : 메모 전용 Google Sheet ID

Google Sheet 준비 방법:
  1. Google Sheets에서 새 스프레드시트 생성 (이름: "AE Intel Notes" 권장)
  2. URL에서 Spreadsheet ID 복사 (https://docs.google.com/spreadsheets/d/<ID>/edit)
  3. GOOGLE_SERVICE_ACCOUNT_JSON의 client_email 값 확인
  4. 해당 스프레드시트를 SA 이메일로 편집자 공유
  5. Render 환경변수에 NOTES_SPREADSHEET_ID 추가

Sheet 컬럼 구조 (자동 생성):
  id | content | account | auto_detected | type | tags | created_at | date | time
"""
import json
import logging
import os
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

SHEET_NAME = "Notes"
HEADERS = ["id", "content", "account", "auto_detected", "type", "tags", "created_at", "date", "time"]


def _get_client():
    """gspread 클라이언트 반환 (Service Account 인증)"""
    sa_json_str = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json_str:
        return None
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        sa_info = json.loads(sa_json_str)
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",  # read+write
            "https://www.googleapis.com/auth/drive",
        ]
        creds = Credentials.from_service_account_info(sa_info, scopes=scopes)
        return gspread.authorize(creds)
    except Exception as e:
        logger.warning(f"gspread 클라이언트 초기화 실패: {e}")
        return None


def _get_worksheet():
    """Notes 워크시트 반환. 없으면 자동 생성."""
    spreadsheet_id = os.environ.get("NOTES_SPREADSHEET_ID", "")
    if not spreadsheet_id:
        return None

    client = _get_client()
    if not client:
        return None

    try:
        sh = client.open_by_key(spreadsheet_id)
        try:
            ws = sh.worksheet(SHEET_NAME)
        except Exception:
            # Notes 시트가 없으면 자동 생성 + 헤더 추가
            ws = sh.add_worksheet(title=SHEET_NAME, rows=1000, cols=len(HEADERS))
            ws.append_row(HEADERS)
            logger.info("Google Sheets 'Notes' 시트 자동 생성 완료")
        return ws
    except Exception as e:
        logger.warning(f"Google Sheets 워크시트 접근 실패: {e}")
        return None


# ── 동기 함수 (gspread는 동기 라이브러리) ──────────────────────────────────

def _sync_read_notes() -> list[dict]:
    ws = _get_worksheet()
    if not ws:
        return []
    try:
        rows = ws.get_all_records(expected_headers=HEADERS)
        notes = []
        for row in rows:
            note = {
                "id":            str(row.get("id", "")),
                "content":       row.get("content", ""),
                "account":       row.get("account") or None,
                "auto_detected": str(row.get("auto_detected", "")).lower() == "true",
                "type":          row.get("type", "text"),
                "tags":          json.loads(row.get("tags", "[]")) if row.get("tags") else [],
                "created_at":    row.get("created_at", ""),
                "date":          row.get("date", ""),
                "time":          row.get("time", ""),
            }
            if note["id"]:
                notes.append(note)
        # 최신순 정렬
        notes.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return notes
    except Exception as e:
        logger.error(f"Sheets 메모 읽기 실패: {e}")
        return []


def _sync_append_note(note: dict) -> bool:
    ws = _get_worksheet()
    if not ws:
        return False
    try:
        row = [
            note.get("id", ""),
            note.get("content", ""),
            note.get("account", "") or "",
            str(note.get("auto_detected", False)),
            note.get("type", "text"),
            json.dumps(note.get("tags", []), ensure_ascii=False),
            note.get("created_at", ""),
            note.get("date", ""),
            note.get("time", ""),
        ]
        ws.append_row(row, value_input_option="RAW")
        return True
    except Exception as e:
        logger.error(f"Sheets 메모 추가 실패: {e}")
        return False


def _sync_delete_note(note_id: str) -> bool:
    ws = _get_worksheet()
    if not ws:
        return False
    try:
        cell = ws.find(note_id, in_column=1)  # id는 1번 컬럼
        if cell:
            ws.delete_rows(cell.row)
            return True
        return False
    except Exception as e:
        logger.error(f"Sheets 메모 삭제 실패: {e}")
        return False


# ── 비동기 래퍼 ──────────────────────────────────────────────────────────────

async def read_notes() -> list[dict]:
    """Sheets에서 전체 메모 반환 (비동기)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_read_notes)


async def append_note(note: dict) -> bool:
    """Sheets에 메모 한 건 추가 (비동기)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_append_note, note)


async def delete_note(note_id: str) -> bool:
    """Sheets에서 메모 삭제 (비동기)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_delete_note, note_id)


def is_available() -> bool:
    """Sheets 연동 사용 가능 여부"""
    return bool(
        os.environ.get("NOTES_SPREADSHEET_ID")
        and os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    )
