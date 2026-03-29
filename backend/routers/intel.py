"""
Intel Router - 메모 저장/조회 + 주간 리포트 API + 자동 sync
Claude API 없이 JSON 파일 기반으로 동작
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
NOTES_FILE = DATA_DIR / "notes.json"
REPORT_FILE = DATA_DIR / "weekly_report.json"


def _read_notes() -> dict:
    if not NOTES_FILE.exists():
        return {"notes": []}
    return json.loads(NOTES_FILE.read_text(encoding="utf-8"))


def _write_notes(data: dict):
    NOTES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_report() -> dict:
    if not REPORT_FILE.exists():
        return {"generated_at": None, "summary": "리포트 없음", "accounts": [], "action_items": []}
    return json.loads(REPORT_FILE.read_text(encoding="utf-8"))


# ── 메모 모델 ──────────────────────────────────────
class NoteCreate(BaseModel):
    content: str
    type: str = "text"          # text | voice
    tags: list[str] = []
    account: Optional[str] = None   # 관련 계정 (선택)


class NoteUpdate(BaseModel):
    content: str


# ── 메모 API ───────────────────────────────────────
@router.get("/notes")
async def get_notes():
    """전체 메모 목록 반환 (최신순)"""
    data = _read_notes()
    notes = sorted(data.get("notes", []), key=lambda x: x.get("created_at", ""), reverse=True)
    return {"notes": notes, "total": len(notes)}


@router.post("/notes")
async def create_note(note: NoteCreate):
    """새 메모 저장 (음성 or 텍스트). account 미지정 시 내용 기반 자동 감지."""
    from ..services.account_keywords import match_account

    resolved_account = note.account
    auto_detected = False
    if not resolved_account:
        resolved_account = match_account(note.content)
        auto_detected = bool(resolved_account)

    data = _read_notes()
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
    data["notes"].append(new_note)
    _write_notes(data)
    return {"ok": True, "note": new_note, "auto_detected": auto_detected}


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str):
    """메모 삭제"""
    data = _read_notes()
    before = len(data["notes"])
    data["notes"] = [n for n in data["notes"] if n.get("id") != note_id]
    if len(data["notes"]) == before:
        raise HTTPException(status_code=404, detail="Note not found")
    _write_notes(data)
    return {"ok": True}


# ── Sync API ──────────────────────────────────────
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


# ── 주간 리포트 API ────────────────────────────────
@router.get("/report")
async def get_report(background_tasks: BackgroundTasks):
    """최신 주간 리포트 반환 (백그라운드에서 자동 sync)"""
    # 오래된 데이터면 백그라운드 sync 트리거 (응답은 즉시)
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
