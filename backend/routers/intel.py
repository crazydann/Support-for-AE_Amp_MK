"""
Intel Router - 메모 저장/조회 + 주간 리포트 API + 자동 sync

메모 저장 우선순위:
  1. Google Sheets (NOTES_SPREADSHEET_ID 설정 시) → 재배포 후에도 영구 보존
  2. notes.json (로컬 fallback - 개발환경 또는 Sheets 미설정 시)
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/intel", tags=["intel"])

DATA_DIR = Path(__file__).parent.parent / "data"
NOTES_FILE  = DATA_DIR / "notes.json"
REPORT_FILE = DATA_DIR / "weekly_report.json"


# ── notes.json fallback 헬퍼 ──────────────────────────────
def _read_notes_local() -> list[dict]:
    if not NOTES_FILE.exists():
        return []
    data = json.loads(NOTES_FILE.read_text(encoding="utf-8"))
    notes = data.get("notes", [])
    return sorted(notes, key=lambda x: x.get("created_at", ""), reverse=True)


def _write_notes_local(notes: list[dict]):
    NOTES_FILE.write_text(
        json.dumps({"notes": notes}, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def _read_report() -> dict:
    if not REPORT_FILE.exists():
        return {"generated_at": None, "summary": "리포트 없음", "accounts": [], "action_items": []}
    return json.loads(REPORT_FILE.read_text(encoding="utf-8"))


# ── 메모 모델 ──────────────────────────────────────────────
class NoteCreate(BaseModel):
    content: str
    type: str = "text"          # text | voice
    tags: list[str] = []
    account: Optional[str] = None   # 미입력 시 내용 기반 자동 감지


# ── 메모 API ──────────────────────────────────────────────
@router.get("/notes")
async def get_notes():
    """전체 메모 목록 반환 (최신순). Sheets 우선, fallback notes.json"""
    from ..services import notes_sheets_service as sheets

    if sheets.is_available():
        try:
            notes = await sheets.read_notes()
            return {"notes": notes, "total": len(notes), "storage": "sheets"}
        except Exception:
            pass  # Sheets 실패 시 fallback

    notes = _read_notes_local()
    return {"notes": notes, "total": len(notes), "storage": "local"}


@router.post("/notes")
async def create_note(note: NoteCreate):
    """새 메모 저장. account 미입력 시 내용 기반 자동 감지. Sheets 우선 저장."""
    from ..services.account_keywords import match_account
    from ..services import notes_sheets_service as sheets

    # 계정 자동 감지
    resolved_account = note.account
    auto_detected = False
    if not resolved_account:
        resolved_account = match_account(note.content)
        auto_detected = bool(resolved_account)

    now = datetime.now()
    new_note = {
        "id": str(uuid.uuid4())[:8],
        "content": note.content,
        "type": note.type,
        "tags": note.tags if note.tags else ([resolved_account] if resolved_account else []),
        "account": resolved_account,
        "auto_detected": auto_detected,
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
    }

    # Sheets에 저장
    storage = "local"
    if sheets.is_available():
        try:
            ok = await sheets.append_note(new_note)
            if ok:
                storage = "sheets"
        except Exception:
            pass  # Sheets 실패 시 fallback

    if storage == "local":
        notes = _read_notes_local()
        notes.insert(0, new_note)
        _write_notes_local(notes)

    # ── Intel Log에도 자동 기록 ──
    try:
        from ..services import intel_memory_service as mem
        preview = note.content[:120] + ("…" if len(note.content) > 120 else "")
        await mem.append_log(
            summary=f"[메모] {preview}",
            log_type="memo",
            account=resolved_account,
            source="user",
        )
    except Exception:
        pass

    return {"ok": True, "note": new_note, "auto_detected": auto_detected, "storage": storage}


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    """메모 삭제. Sheets 우선, fallback notes.json"""
    from ..services import notes_sheets_service as sheets

    if sheets.is_available():
        try:
            ok = await sheets.delete_note(note_id)
            if ok:
                return {"ok": True, "storage": "sheets"}
            # Sheets에 없으면 local도 시도
        except Exception:
            pass

    # fallback: notes.json
    notes = _read_notes_local()
    before = len(notes)
    notes = [n for n in notes if n.get("id") != note_id]
    if len(notes) == before:
        raise HTTPException(status_code=404, detail="Note not found")
    _write_notes_local(notes)
    return {"ok": True, "storage": "local"}


@router.get("/notes/storage")
async def get_notes_storage():
    """메모 저장소 상태 확인"""
    from ..services import notes_sheets_service as sheets
    return {
        "sheets_available": sheets.is_available(),
        "spreadsheet_id": bool(__import__("os").environ.get("NOTES_SPREADSHEET_ID")),
        "service_account": bool(__import__("os").environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")),
    }


# ── Sync API ──────────────────────────────────────────────
@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, force: bool = False):
    """Gmail/Calendar/Slack 데이터 동기화 트리거"""
    try:
        from ..services.report_sync import run_sync_async
        result = await run_sync_async(force=force)
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync/status")
async def get_sync_status():
    """마지막 sync 상태 반환"""
    sync_state_file = DATA_DIR / "sync_state.json"
    if not sync_state_file.exists():
        return {"last_sync": None, "processed_count": 0}
    state = json.loads(sync_state_file.read_text(encoding="utf-8"))
    return {
        "last_sync": state.get("last_sync"),
        "processed_count": len(state.get("processed_ids", [])),
    }


# ── 주간 리포트 API ───────────────────────────────────────
@router.get("/report")
async def get_report(background_tasks: BackgroundTasks):
    """최신 주간 리포트 반환 (백그라운드에서 자동 sync)"""
    def _bg_sync():
        try:
            from ..services.report_sync import run_sync
            run_sync(force=False)
        except Exception:
            pass

    background_tasks.add_task(_bg_sync)
    return _read_report()


@router.get("/report/accounts")
async def get_report_accounts():
    """계정 현황만 반환 (대시보드 카드용)"""
    report = _read_report()
    return {
        "accounts": report.get("accounts", []),
        "generated_at": report.get("generated_at"),
    }


@router.get("/report/actions")
async def get_report_actions():
    """Action Items만 반환"""
    report = _read_report()
    return {
        "action_items": report.get("action_items", []),
        "risks": report.get("risks", []),
    }


@router.put("/report")
async def update_report(report: dict):
    """Claude Code에서 주간 리포트 업데이트 (JSON 전체 교체)"""
    report["generated_at"] = datetime.now().isoformat()
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "generated_at": report["generated_at"]}


# ── Intel Log API ─────────────────────────────────────────────

class LogEntry(BaseModel):
    summary: str
    type: str = "insight"       # memo | gmail | slack | insight | strategy
    account: Optional[str] = None
    source: str = "claude"      # user | gmail | slack | claude | system


@router.get("/log")
async def get_intel_log(account: Optional[str] = None, days: int = 90):
    """Intel Log 조회. account/days 필터 지원."""
    from ..services import intel_memory_service as mem
    entries = await mem.read_log(account=account, days=days)
    return {"entries": entries, "total": len(entries)}


@router.post("/log")
async def append_intel_log(entry: LogEntry):
    """Intel Log에 이벤트 수동 추가 (Claude 인사이트 등)."""
    from ..services import intel_memory_service as mem
    ok = await mem.append_log(
        summary=entry.summary,
        log_type=entry.type,
        account=entry.account,
        source=entry.source,
    )
    return {"ok": ok}


# ── Account Memory API ────────────────────────────────────────

class MemoryEntry(BaseModel):
    account: str
    insight: str
    type: str = "synthesis"     # synthesis | risk | opportunity | action
    source: str = "claude"


@router.get("/memory")
async def get_account_memory(account: Optional[str] = None):
    """Account Memory 조회. account 미지정 시 전체 반환."""
    from ..services import intel_memory_service as mem
    memory = await mem.read_memory(account=account)
    return {"memory": memory}


@router.post("/memory")
async def append_account_memory(entry: MemoryEntry):
    """Account Memory에 인사이트 추가."""
    from ..services import intel_memory_service as mem
    ok = await mem.append_memory(
        account=entry.account,
        insight=entry.insight,
        insight_type=entry.type,
        source=entry.source,
    )
    return {"ok": ok}


@router.post("/memory/synthesize")
async def synthesize_memory(account: Optional[str] = None, days: int = 60):
    """
    Intel Log → Account Memory 자동 합성.
    Claude가 '/메모리 업데이트' 명령 시 호출 예정.
    특정 계정 지정 또는 전체 합성 가능.
    """
    from ..services import intel_memory_service as mem
    import json as _json

    report = _read_report()
    accounts_list = (
        [account] if account
        else [a["key_account"] for a in report.get("accounts", [])]
    )

    synthesized = []
    for acct in accounts_list:
        entries = await mem.read_log(account=acct, days=days)
        if not entries:
            continue
        # 간단한 자동 합성: 최근 활동 요약
        types = {}
        for e in entries:
            t = e.get("type", "etc")
            types[t] = types.get(t, 0) + 1
        summary_parts = [f"{t} {cnt}건" for t, cnt in types.items()]
        insight = (
            f"최근 {days}일 활동 요약: {', '.join(summary_parts)}. "
            f"최신: {entries[0].get('summary', '')[:80]}"
        )
        await mem.append_memory(acct, insight, insight_type="auto-synthesis", source="system")
        synthesized.append(acct)

    return {"ok": True, "synthesized": synthesized, "count": len(synthesized)}


# ── Glean Ingest API ──────────────────────────────────────────

class GleanEntry(BaseModel):
    account:   str
    title:     str = ""
    summary:   str = ""
    url:       str = ""
    date:      str = ""
    type:      str = "glean"
    source_id: str = ""


class GleanIngestRequest(BaseModel):
    entries: list[GleanEntry]


@router.post("/glean-ingest")
async def glean_ingest(body: GleanIngestRequest):
    """
    Claude Code가 Glean MCP로 검색한 결과를 intel_log에 저장.
    중복 source_id는 자동으로 스킵.
    """
    from ..services.glean_sync_service import ingest_glean_results

    entries_dicts = [e.dict() for e in body.entries]
    result = ingest_glean_results(entries_dicts)
    return {"ok": True, **result}


@router.get("/glean-sync-status")
async def glean_sync_status():
    """Glean 동기화 상태 반환 (마지막 실행, 처리 건수)."""
    from ..services.glean_sync_service import get_sync_status

    return get_sync_status()
