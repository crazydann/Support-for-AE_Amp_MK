"""
Intel Router - 메모 저장/조회 + 주간 리포트 API + 자동 sync

메모 저장 우선순위:
  1. Google Sheets (NOTES_SPREADSHEET_ID 설정 시) → 재배포 후에도 영구 보존
  2. notes.json (로컬 fallback - 개발환경 또는 Sheets 미설정 시)
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/intel", tags=["intel"])

DATA_DIR = Path(__file__).parent.parent / "data"
NOTES_FILE  = DATA_DIR / "notes.json"
REPORT_FILE = DATA_DIR / "weekly_report.json"

# 합성 백그라운드 실행 여부 추적
_synthesis_running = False


# ── 수동 동기화 엔드포인트 (프론트 동기화 버튼용) ──────────────
@router.post("/sync")
@router.get("/sync")
async def manual_sync(force: bool = True):
    """
    Gmail/Calendar/Slack 데이터 수집 (빠름, 30초 이내) + 합성은 백그라운드 실행.
    동기화 버튼에서 호출.
    """
    global _synthesis_running
    import asyncio as _asyncio

    # ── 1단계: 데이터 수집 (빠름) ─────────────────────────────
    sync_result = {"added": 0, "skipped": False, "error": None}
    memo_added = 0
    errors = []

    try:
        from ..services.report_sync import run_sync_async
        sync_result = await _asyncio.wait_for(run_sync_async(force=True), timeout=60)
    except _asyncio.TimeoutError:
        errors.append("Gmail/Slack sync timed out (60s)")
    except Exception as e:
        errors.append(f"Sync error: {str(e)}")

    # ── 1.5단계: Sheets 메모 수집 (빠름) ────────────────────────
    try:
        from ..services.notes_sheets_service import read_notes, is_available
        from ..services.intel_memory_service import _sync_append_log
        from ..services.account_keywords import detect_account
        from pathlib import Path as _Path

        if is_available():
            notes = await read_notes()
            intel_log_file = _Path(__file__).parent.parent / "data" / "intel_log.jsonl"
            existing_ids: set = set()
            if intel_log_file.exists():
                import json as _json
                for line in intel_log_file.read_text(encoding="utf-8").splitlines():
                    try:
                        src_id = _json.loads(line).get("source_id") or _json.loads(line).get("memo_id")
                        if src_id:
                            existing_ids.add(src_id)
                    except Exception:
                        pass
            from datetime import datetime as _dt, timezone as _tz
            for note in notes:
                note_id = note.get("id", "")
                if note_id and note_id in existing_ids:
                    continue
                content = note.get("content", "")
                account = note.get("account") or detect_account(content)
                date = (note.get("created_at") or note.get("date") or "")[:10]
                _sync_append_log({
                    "ts": note.get("created_at") or _dt.now(_tz.utc).isoformat(),
                    "date": date, "type": "memo", "log_type": "memo",
                    "account": account, "summary": f"[메모] {content[:80]}",
                    "source": "sheets_memo", "source_id": note_id, "memo_id": note_id,
                })
                existing_ids.add(note_id)
                memo_added += 1
    except Exception as e:
        errors.append(f"Memo sync error: {str(e)}")

    # ── 2단계: 합성 실행 (최대 45초, 완료되면 즉시 반영) ───────────
    synth_result = {}
    try:
        from ..services import synthesis_service as synth
        loop = _asyncio.get_event_loop()
        synth_result = await _asyncio.wait_for(
            loop.run_in_executor(None, synth.run_full_synthesis, 60),
            timeout=45
        )
    except _asyncio.TimeoutError:
        # 타임아웃 시 백그라운드로 계속 실행
        if not _synthesis_running:
            async def _run_synthesis_bg():
                global _synthesis_running
                _synthesis_running = True
                try:
                    await loop.run_in_executor(None, synth.run_full_synthesis, 60)
                except Exception:
                    pass
                finally:
                    _synthesis_running = False
            _asyncio.create_task(_run_synthesis_bg())
        synth_result = {"note": "synthesis timed out, running in background"}
    except Exception as ex:
        errors.append(f"Synthesis error: {str(ex)}")

    added = sync_result.get("added", 0)
    return {
        "ok": True,
        "added": added,
        "memo_added": memo_added,
        "synthesis": synth_result,
        "errors": errors,
        "message": f"동기화 완료 — 신규 {added}건, 메모 {memo_added}건" + (f" (오류: {len(errors)}건)" if errors else ""),
    }


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
    """새 메모 저장. account 미입력 시 내용 기반 자동 감지.
    여러 계정이 감지되면 계정별로 각각 저장. Sheets 우선 저장."""
    from ..services.account_keywords import match_account, match_accounts_all
    from ..services import notes_sheets_service as sheets

    now = datetime.now()
    preview = note.content[:120] + ("…" if len(note.content) > 120 else "")

    # 계정 자동 감지
    if note.account:
        # 명시적으로 계정 지정된 경우
        target_accounts = [note.account]
        auto_detected = False
    else:
        detected = match_accounts_all(note.content)
        if detected:
            target_accounts = detected
            auto_detected = True
        else:
            target_accounts = [None]
            auto_detected = False

    created_notes = []
    storage = "local"

    for acct in target_accounts:
        new_note = {
            "id": str(uuid.uuid4())[:8],
            "content": note.content,
            "type": note.type,
            "tags": note.tags if note.tags else ([acct] if acct else []),
            "account": acct,
            "auto_detected": auto_detected,
            "created_at": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M"),
        }

        # Sheets에 저장
        note_storage = "local"
        if sheets.is_available():
            try:
                ok = await sheets.append_note(new_note)
                if ok:
                    note_storage = "sheets"
                    storage = "sheets"
            except Exception:
                pass

        if note_storage == "local":
            notes = _read_notes_local()
            notes.insert(0, new_note)
            _write_notes_local(notes)

        # ── Intel Log에도 자동 기록 ──
        try:
            from ..services import intel_memory_service as mem
            await mem.append_log(
                summary=f"[메모] {preview}",
                log_type="memo",
                account=acct,
                source="user",
            )
        except Exception:
            pass

        # ── 계정 지정 메모: weekly_report activity_history 자동 업데이트 ──
        if acct:
            try:
                report = _read_report()
                accounts = report.get("accounts", [])
                updated = False
                for acc in accounts:
                    if acc.get("key_account") == acct:
                        history = acc.setdefault("activity_history", [])
                        # 중복 방지: 같은 날 같은 요약이면 skip
                        existing_summaries = {h.get("summary", "")[:60] for h in history}
                        entry_summary = f"[메모] {preview}"
                        if entry_summary[:60] not in existing_summaries:
                            history.insert(0, {
                                "date": now.strftime("%Y-%m-%d"),
                                "type": "memo",
                                "summary": entry_summary,
                            })
                            # 최근 50건만 유지
                            acc["activity_history"] = history[:50]
                            acc["last_activity"] = now.strftime("%Y-%m-%d")
                        updated = True
                        break
                if updated:
                    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                pass

        created_notes.append(new_note)

    # 단일 계정 저장 시 하위 호환성 유지
    primary_note = created_notes[0] if created_notes else None
    return {
        "ok": True,
        "note": primary_note,
        "notes": created_notes,
        "accounts_detected": target_accounts,
        "auto_detected": auto_detected,
        "storage": storage,
    }


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


# ── Synthesis API ─────────────────────────────────────────────

@router.post("/synthesize")
async def run_synthesis(days: int = 60):
    """전체 계정 합성 실행. intel_log → account_memory + weekly_report 업데이트."""
    from ..services import synthesis_service as synth
    result = await asyncio.get_event_loop().run_in_executor(
        None, synth.run_full_synthesis, days
    )
    return {"ok": True, **result}


@router.post("/synthesize/{account_name}")
async def synthesize_account(account_name: str, days: int = 60):
    """특정 계정 합성."""
    from ..services import synthesis_service as synth
    result = synth.synthesize_account(account_name, days=days)
    if result:
        from ..services import intel_memory_service as mem
        insight = result.get("strategy_update", "")
        if insight:
            await mem.append_memory(
                account=account_name,
                insight=insight,
                insight_type="synthesis",
                source="claude"
            )
    return {"ok": True, "result": result}

# ── Action Status API (완료 체크 + 메모) ─────────────────────────────────────

ACTION_STATUS_FILE = DATA_DIR / "action_status.json"


def _read_action_status() -> dict:
    if not ACTION_STATUS_FILE.exists():
        return {}
    try:
        return json.loads(ACTION_STATUS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_action_status(data: dict):
    ACTION_STATUS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class ActionStatusUpdate(BaseModel):
    action_id: str
    done: bool = False
    note: str = ""


@router.get("/action-status")
async def get_action_status():
    """모든 액션 아이템 완료 상태 + 메모 반환."""
    return {"statuses": _read_action_status()}


@router.post("/action-status")
async def update_action_status(body: ActionStatusUpdate):
    """액션 아이템 완료 상태 및 메모 저장."""
    statuses = _read_action_status()
    statuses[body.action_id] = {
        "done": body.done,
        "note": body.note,
        "updated_at": datetime.now().isoformat(),
    }
    _write_action_status(statuses)
    return {"ok": True}


# ── Translation API ───────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    texts: list[str]
    target_lang: str = "en"
    source_lang: str = "ko"


@router.post("/translate")
async def translate_texts_endpoint(body: TranslateRequest):
    """
    한국어 텍스트 배치 번역 (Google Translate 비공식 API + 파일 캐시).
    Returns: {"translations": {"원문": "translated", ...}}
    """
    from ..services.translate_service import translate_texts

    if not body.texts:
        return {"translations": {}}

    # 배치 최대 50건
    texts = list({t for t in body.texts if t})[:50]
    translations = translate_texts(texts, target_lang=body.target_lang, source_lang=body.source_lang)
    return {"translations": translations}


# ── Weekly Synthesis API ─────────────────────────────────────────────────────

WEEKLY_SYNTHESIS_FILE = DATA_DIR / "weekly_synthesis.json"

DEFAULT_SYNTHESIS = {
    "generated_at": "2026-03-31",
    "period": "2026-03-30 ~ 2026-04-05",
    "period_label": "Q1 마감·Q2 킥오프",
    "highlights": [
        {"type": "hot", "account": "CJ Olive Young", "title": "$450K 오더폼 서명 요청 발송", "desc": "MK → 박소현(CJ OliveNetworks) OF 전달 완료, DC CC 서명 요청. 글로벌 견적도 별도 논의 중. 4/1 계약 시작 목표"},
        {"type": "hot", "account": "신세계 DF", "title": "4/2 마케팅·AI 임원 데모 (D-2)", "desc": "오후 2~3시 임원 데모 + 3~4시 RFP 논의. Use Case 및 RFP 항목 준비 최우선"},
        {"type": "hot", "account": "CJ CheilJedang (The Market)", "title": "MTU 817% 오버리지 — 즉각 대응 필요", "desc": "CSM과 함께 업그레이드 제안 준비 및 고객 연락 필요. 방치 시 이탈 리스크"},
        {"type": "hot", "account": "LG Uplus (CTO)", "title": "갱신 D-31 긴급", "desc": "Stage2에 불과, EB 미컨펌 상태. infiniSTAR 갱신 Closed Lost 선례 있음 → 즉각 대응"},
    ],
    "new_pipeline": [
        {"account": "SSG.com", "desc": "퀵미팅 x2 (3/30) — Martinee 파트너 연계, 적극 논의 중"},
        {"account": "KakaoBank", "desc": "데모·POC 제안 (3/24) — 첫 접점 확보, 후속 미팅 필요"},
        {"account": "Woori Card", "desc": "미팅 진행 (3/24) — 관계 구축 단계, 니즈 파악 중"},
        {"account": "Dunamu", "desc": "저녁 미팅 (3/25) — Experiment Add-on 크로스셀 기회 포착"},
        {"account": "Lotte", "desc": "롯데마트 상무 + 롯데온 상무 연속 미팅 — 그룹 MTU 전략 전개 적기"},
    ],
    "risks": [
        {"account": "LG Uplus (CTO)", "desc": "D-31 만료. 갱신 Stage2에 불과, EB 미컨펌. infiniSTAR 갱신 Closed Lost 선례 있어 위험도 높음"},
        {"account": "TVING", "desc": "D-62 만료. Stage5 진행 중이나 클로징이 만료일보다 늦어질 위험. Experiment 샌드박스만 요청"},
        {"account": "Naver Corp", "desc": "PoC 전면 중단. CTO→회장 인하우스 결정. Naver Shopping Q2 딜 Q4로 슬립, 여름까지 재개 불가"},
    ],
    "meeting_count": 4,
    "meeting_accounts": ["CJ Olive Young Global", "CJ Olive Young", "SSG.com(×2)"],
    "insights": [
        {"title": "이번 주 최우선: CJ Olive Young 클로징", "desc": "OF 서명 요청 발송 완료. 박소현 사인 받는 즉시 Stage6 Closed Won 전환"},
        {"title": "4/2 신세계 DF 임원 데모 준비", "desc": "마케팅+AI 임원 대상 데모. RFP 항목 사전 정리 필수. Enterprise 레퍼런스(올리브영) 적극 활용"},
        {"title": "LG Uplus D-31 — 지금이 골든타임", "desc": "infiniSTAR Closed Lost 전례를 반면교사로. 이번 주 EB 컨펌 + 조건 협의 착수 필수"},
    ],
}

def _generate_synthesis_from_report() -> dict:
    """weekly_report.json + intel_log.jsonl 에서 실시간으로 synthesis 생성"""
    from datetime import timedelta
    today = datetime.now()
    dow = today.weekday()  # 0=Mon
    this_monday = today - timedelta(days=dow)
    this_sunday = this_monday + timedelta(days=6)
    week_start = this_monday.strftime("%Y-%m-%d")
    week_end = this_sunday.strftime("%Y-%m-%d")
    period = f"{week_start} ~ {week_end}"

    report = _read_report()
    action_items = report.get("action_items", [])
    risks_raw = report.get("risks", [])
    accounts = report.get("accounts", [])

    # ── highlights: urgent 액션 최대 4개 ──
    urgent = [a for a in action_items if a.get("priority") == "urgent"][:4]
    highlights = []
    for a in urgent:
        due_str = a.get("due") or a.get("due_date") or ""
        d_label = ""
        if due_str:
            try:
                diff = (datetime.strptime(due_str, "%Y-%m-%d") - today).days
                d_label = f" (D{diff:+d})" if diff != 0 else " (오늘)"
            except Exception:
                pass
        highlights.append({
            "type": "hot",
            "account": a.get("account", ""),
            "title": (a.get("action") or "")[:50] + d_label,
            "desc": (a.get("action") or ""),
        })

    # ── new_pipeline: prospect 계정 ──
    prospects = [a for a in accounts if a.get("status") == "prospect"]
    new_pipeline = [
        {"account": p.get("key_account", ""), "desc": p.get("notes_summary", p.get("strategy", ""))}
        for p in prospects[:5]
    ]

    # ── risks: 상위 3개 ──
    risks = [
        {"account": r.get("account", ""), "desc": r.get("risk", r.get("desc", ""))}
        for r in risks_raw[:3]
    ]

    # ── 이번 주 미팅 (intel_log) ──
    meeting_accounts: list = []
    meeting_count = 0
    try:
        log_file = DATA_DIR / "intel_log.jsonl"
        if log_file.exists():
            with log_file.open(encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        e = json.loads(line)
                    except Exception:
                        continue
                    e_type = e.get("type") or e.get("log_type") or ""
                    e_date = e.get("date") or ""
                    if e_type == "meeting" and week_start <= e_date <= week_end:
                        meeting_count += 1
                        acc = e.get("account") or ""
                        if acc and acc not in meeting_accounts:
                            meeting_accounts.append(acc)
    except Exception:
        pass

    # ── insights: urgent 중 상위 3개 재활용 ──
    insights = []
    for a in (urgent[:3] if urgent else action_items[:3]):
        insights.append({
            "title": a.get("account", ""),
            "desc": (a.get("action") or "")[:80],
        })

    return {
        "generated_at": today.strftime("%Y-%m-%d"),
        "period": period,
        "period_label": "",
        "highlights": highlights,
        "new_pipeline": new_pipeline,
        "risks": risks,
        "meeting_count": meeting_count,
        "meeting_accounts": meeting_accounts,
        "insights": insights,
    }


@router.get("/weekly-synthesis")
async def get_weekly_synthesis():
    """주간 AI 합성 리포트 반환 — 파일 있으면 파일, 없으면 weekly_report에서 실시간 생성"""
    # 파일이 있고 7일 이내면 파일 우선
    if WEEKLY_SYNTHESIS_FILE.exists():
        try:
            data = json.loads(WEEKLY_SYNTHESIS_FILE.read_text(encoding="utf-8"))
            if data.get("period"):
                return data
        except Exception:
            pass
    # 파일 없거나 손상 → 실시간 생성 후 저장
    data = _generate_synthesis_from_report()
    try:
        WEEKLY_SYNTHESIS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass
    return data


@router.post("/weekly-synthesis")
async def update_weekly_synthesis(body: dict):
    """주간 AI 합성 리포트 저장 (Claude 분석 결과 수동 저장용)"""
    body["generated_at"] = datetime.now().strftime("%Y-%m-%d")
    WEEKLY_SYNTHESIS_FILE.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@router.post("/weekly-synthesis/regenerate")
async def regenerate_weekly_synthesis():
    """weekly_report.json에서 synthesis 강제 재생성"""
    data = _generate_synthesis_from_report()
    WEEKLY_SYNTHESIS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


# ── Weekly Feed API (non-SFDC: Gmail/Slack/Calendar/Glean/Memo) ──────────────

@router.get("/weekly-feed")
async def get_weekly_feed(days: int = 180):
    """
    주간 피드: Gmail, Slack, Calendar, Glean, Memo 타입만 반환 (SFDC 제외).
    intel_log.jsonl에서 최근 N일치 필터링 후 날짜 내림차순으로 반환.
    캘린더 이벤트는 gcal_sync를 통해 실시간 보충 시도.
    """
    from ..services import intel_memory_service as mem
    from datetime import datetime, timedelta

    INCLUDE_TYPES = {"gmail", "slack", "meeting", "glean", "memo", "insight", "drive"}
    EXCLUDE_TYPES = {"sfdc", "weekly_report"}

    # intel_log에서 읽기
    all_entries = await mem.read_log(days=days)

    # SFDC/weekly_report 제외
    entries = [
        e for e in all_entries
        if (e.get("type") or e.get("log_type", "")) not in EXCLUDE_TYPES
    ]

    # 날짜 내림차순 정렬
    entries.sort(key=lambda e: (e.get("date") or e.get("ts") or ""), reverse=True)

    # 타입별 집계
    by_type: dict[str, list] = {}
    for e in entries:
        t = e.get("type") or e.get("log_type") or "etc"
        by_type.setdefault(t, []).append(e)

    # 날짜별 집계
    by_date: dict[str, list] = {}
    for e in entries:
        d = (e.get("date") or (e.get("ts") or "")[:10] or "unknown")
        by_date.setdefault(d, []).append(e)

    # 이번 주 action_items + 계정 메타 (weekly_report에서)
    report = _read_report()
    action_items = report.get("action_items", [])
    risks = report.get("risks", [])

    # 계정 메타 (health, group, arr — SFDC Closed Won 기준 ARR 포함)
    account_meta = {
        a["key_account"]: {
            "health": a.get("health", "gray"),
            "group":  a.get("group", ""),
            "arr":    a.get("arr", 0),
        }
        for a in report.get("accounts", [])
    }

    return {
        "entries": entries,
        "total": len(entries),
        "by_type": {t: len(v) for t, v in by_type.items()},
        "by_date": by_date,
        "action_items": action_items,
        "risks": risks,
        "account_meta": account_meta,
    }


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


# ── Agent Analytics Audit (스트리밍) ─────────────────────────────────────────

SKILL_FILE = DATA_DIR / "skills" / "agent-analytics-audit.md"
INTEL_LOG_FILE = DATA_DIR / "intel_log.jsonl"
ACCOUNT_MEMORY_FILE = DATA_DIR / "account_memory.json"


def _build_audit_context(account_name: str) -> str:
    """계정 관련 모든 데이터를 컨텍스트로 조립"""
    report = _read_report()

    # 1) 계정 기본 정보
    acct_data = next(
        (a for a in report.get("accounts", []) if a["key_account"] == account_name),
        None,
    )

    # 2) Intel log (최근 90일, 해당 계정)
    intel_entries = []
    if INTEL_LOG_FILE.exists():
        for line in INTEL_LOG_FILE.read_text(encoding="utf-8").splitlines():
            try:
                entry = json.loads(line)
                if entry.get("account") == account_name:
                    intel_entries.append(entry)
            except Exception:
                pass
    intel_entries = intel_entries[-30:]  # 최대 30건

    # 3) Account memory
    memory_data = {}
    if ACCOUNT_MEMORY_FILE.exists():
        try:
            memory = json.loads(ACCOUNT_MEMORY_FILE.read_text(encoding="utf-8"))
            memory_data = memory.get(account_name, {})
        except Exception:
            pass

    # 4) Action items / risks
    action_items = [a for a in report.get("action_items", []) if a.get("account") == account_name]
    risks = [r for r in report.get("risks", []) if r.get("account") == account_name]

    ctx_parts = [f"# 분석 대상 계정: {account_name}\n"]
    if acct_data:
        ctx_parts.append(f"## 계정 기본 정보\n```json\n{json.dumps(acct_data, ensure_ascii=False, indent=2)}\n```\n")
    if action_items:
        ctx_parts.append(f"## 액션 아이템\n```json\n{json.dumps(action_items, ensure_ascii=False, indent=2)}\n```\n")
    if risks:
        ctx_parts.append(f"## 리스크\n```json\n{json.dumps(risks, ensure_ascii=False, indent=2)}\n```\n")
    if intel_entries:
        ctx_parts.append(f"## 최근 Intel 로그 ({len(intel_entries)}건)\n```json\n{json.dumps(intel_entries, ensure_ascii=False, indent=2)}\n```\n")
    if memory_data:
        ctx_parts.append(f"## Account Memory (합성 인텔리전스)\n```json\n{json.dumps(memory_data, ensure_ascii=False, indent=2)}\n```\n")

    return "\n".join(ctx_parts)


AUDIT_SYSTEM_PROMPT = """당신은 Amplitude의 AI 에이전트 도입 현황을 분석하는 전문 어시스트입니다.
제공된 계정 데이터(SFDC, Slack, Intel 로그, Account Memory)를 바탕으로 아래 형식의 분석 리포트를 한국어로 작성하세요.

## 리포트 구조 (반드시 이 순서로)

### 1. Executive Summary
3문장 이내: AI 기능이 가치를 제공하고 있는지, 잘 되는 것, 가장 큰 리스크

### 2. 계정 현황 스코어카드
- ARR, Plan, 계약 만료일, Health 상태
- 최근 주요 활동 타임라인

### 3. Amplitude AI 도입 분석
이 계정에서 Amplitude AI 기능(Global Chat, Experiment 등)이 어떻게 활용되고 있는지,
또는 활용되지 않고 있다면 그 이유와 기회 분석

### 4. 리스크 및 기회
- 단기 리스크 (30일 이내)
- 중기 기회 (90일 이내 액션)

### 5. AI Context 개선 권장사항
이 계정의 Amplitude 사용 패턴을 기반으로 AI 에이전트 품질 향상을 위한 구체적 제언
(taxonomy mapping, KPI 정의, 에이전트 설정 등)

### 6. 다음 액션 플랜
우선순위별 구체적 액션 (담당자, 기한 포함)

---
마크다운 형식으로 작성하고, 실행 가능한 인사이트에 집중하세요."""


@router.post("/agent-audit/{account_name:path}")
async def agent_audit_stream(account_name: str):
    """
    특정 계정에 대해 Agent Analytics Audit 스킬을 실행하고 결과를 스트리밍합니다.
    """
    from ..config import Settings
    settings = Settings()
    api_key = settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    context = _build_audit_context(account_name)

    async def generate():
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)

            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                system=AUDIT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": context}],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── 서비스 연결 진단 엔드포인트 ──────────────────────────────
@router.get("/check")
async def check_services():
    """
    모든 서비스 연결 상태 확인 (Google OAuth, Sheets, Slack, Scheduler, 데이터)
    브라우저에서 /api/intel/check 로 접속해 전체 상태 확인 가능
    """
    result = {}

    # ── 0. 환경변수 존재 여부 디버그 ────────────────────────────
    _gid = os.environ.get("GOOGLE_CLIENT_ID", "")
    _gsec = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    _gref = os.environ.get("GOOGLE_REFRESH_TOKEN", "")
    result["_env_debug"] = {
        "GOOGLE_CLIENT_ID": f"{_gid[:12]}..." if _gid else "MISSING",
        "GOOGLE_CLIENT_SECRET": f"{_gsec[:8]}..." if _gsec else "MISSING",
        "GOOGLE_REFRESH_TOKEN": f"{_gref[:8]}..." if _gref else "MISSING",
        "SLACK_USER_TOKEN": "SET" if os.environ.get("SLACK_USER_TOKEN") else "MISSING",
    }

    # ── 1. Google OAuth / Gmail ──────────────────────────────
    try:
        from google.oauth2.credentials import Credentials as GCredentials
        from google.auth.transport.requests import Request as GRequest
        _gid = os.environ.get("GOOGLE_CLIENT_ID", "")
        _gsec = os.environ.get("GOOGLE_CLIENT_SECRET", "")
        _gref = os.environ.get("GOOGLE_REFRESH_TOKEN", "")
        if not all([_gid, _gsec, _gref]):
            result["gmail"] = {"ok": False, "msg": "Missing env vars"}
        else:
            _creds = GCredentials(
                token=None, refresh_token=_gref, client_id=_gid, client_secret=_gsec,
                token_uri="https://oauth2.googleapis.com/token",
                scopes=["https://mail.google.com/"],
            )
            try:
                _creds.refresh(GRequest())
                import httpx
                r = httpx.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                    headers={"Authorization": f"Bearer {_creds.token}"},
                    timeout=10,
                )
                if r.status_code == 200:
                    result["gmail"] = {"ok": True, "email": r.json().get("emailAddress"), "msg": "Connected"}
                else:
                    result["gmail"] = {"ok": False, "msg": f"Gmail API error {r.status_code}: {r.text[:200]}"}
            except Exception as refresh_err:
                result["gmail"] = {"ok": False, "msg": f"Token refresh failed: {str(refresh_err)}"}
    except Exception as e:
        result["gmail"] = {"ok": False, "msg": str(e)}

    # ── 2. Google Calendar ───────────────────────────────────
    try:
        from ..services.google_auth import get_google_credentials
        creds = get_google_credentials()
        if creds and creds.valid:
            import httpx
            r = httpx.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary",
                headers={"Authorization": f"Bearer {creds.token}"},
                timeout=10,
            )
            if r.status_code == 200:
                cal = r.json()
                result["google_calendar"] = {"ok": True, "calendar": cal.get("summary"), "msg": "Connected"}
            else:
                result["google_calendar"] = {"ok": False, "msg": f"API error {r.status_code}"}
        else:
            result["google_calendar"] = {"ok": False, "msg": "No valid credentials (see gmail check)"}
    except Exception as e:
        result["google_calendar"] = {"ok": str(e)}

    # ── 3. Google Sheets ─────────────────────────────────────
    try:
        spreadsheet_id = os.environ.get("NOTES_SPREADSHEET_ID")
        if not spreadsheet_id:
            result["google_sheets"] = {"ok": False, "msg": "NOTES_SPREADSHEET_ID not set"}
        else:
            import gspread
            from google.oauth2.service_account import Credentials as SACredentials
            sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
            if not sa_json:
                result["google_sheets"] = {"ok": False, "msg": "GOOGLE_SERVICE_ACCOUNT_JSON not set"}
            else:
                import json as _json
                sa_info = _json.loads(sa_json)
                scopes = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
                sa_creds = SACredentials.from_service_account_info(sa_info, scopes=scopes)
                gc = gspread.authorize(sa_creds)
                sh = gc.open_by_key(spreadsheet_id)
                worksheets = [w.title for w in sh.worksheets()]
                result["google_sheets"] = {"ok": True, "spreadsheet": sh.title, "sheets": worksheets, "msg": "Connected"}
    except Exception as e:
        result["google_sheets"] = {"ok": False, "msg": str(e)}

    # ── 4. Slack ─────────────────────────────────────────────
    try:
        slack_token = os.environ.get("SLACK_USER_TOKEN") or os.environ.get("SLACK_BOT_TOKEN")
        if not slack_token:
            result["slack"] = {"ok": False, "msg": "SLACK_USER_TOKEN / SLACK_BOT_TOKEN not set"}
        else:
            import httpx
            r = httpx.get(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {slack_token}"},
                timeout=10,
            )
            data = r.json()
            if data.get("ok"):
                result["slack"] = {"ok": True, "user": data.get("user"), "team": data.get("team"), "msg": "Connected"}
            else:
                result["slack"] = {"ok": False, "msg": data.get("error", "unknown error")}
    except Exception as e:
        result["slack"] = {"ok": False, "msg": str(e)}

    # ── 5. Scheduler ─────────────────────────────────────────
    try:
        from ..main import _scheduler, _SCHEDULER_AVAILABLE
        if not _SCHEDULER_AVAILABLE:
            result["scheduler"] = {"ok": False, "msg": "APScheduler not installed"}
        elif not _scheduler:
            result["scheduler"] = {"ok": False, "msg": "Scheduler not initialized"}
        else:
            jobs = _scheduler.get_jobs()
            job_info = []
            for j in jobs:
                import datetime as _dt
                kst = _dt.timezone(_dt.timedelta(hours=9))
                job_info.append({
                    "id": j.id,
                    "next_run_kst": j.next_run_time.astimezone(kst).strftime("%Y-%m-%d %H:%M KST") if j.next_run_time else None,
                })
            result["scheduler"] = {"ok": _scheduler.running, "running": _scheduler.running, "jobs": job_info, "msg": "Running" if _scheduler.running else "Stopped"}
    except Exception as e:
        result["scheduler"] = {"ok": False, "msg": str(e)}

    # ── 6. 데이터 통계 ───────────────────────────────────────
    try:
        intel_log_file = DATA_DIR.parent / "data" / "intel_log.jsonl"
        if not intel_log_file.exists():
            intel_log_file = DATA_DIR / "intel_log.jsonl"

        if intel_log_file.exists():
            lines = [l for l in intel_log_file.read_text(encoding="utf-8").splitlines() if l.strip()]
            entries = []
            for line in lines:
                try:
                    entries.append(json.loads(line))
                except Exception:
                    pass
            by_type: dict = {}
            for e in entries:
                t = e.get("log_type") or e.get("type") or "unknown"
                by_type[t] = by_type.get(t, 0) + 1
            last_entry = entries[-1] if entries else {}
            result["intel_log"] = {
                "ok": True,
                "total": len(entries),
                "by_type": by_type,
                "last_entry_date": last_entry.get("date") or last_entry.get("created_at", "")[:10],
            }
        else:
            result["intel_log"] = {"ok": False, "msg": "intel_log.jsonl not found"}
    except Exception as e:
        result["intel_log"] = {"ok": False, "msg": str(e)}

    try:
        report = _read_report()
        result["weekly_report"] = {
            "ok": True,
            "generated_at": report.get("generated_at"),
            "accounts": len(report.get("accounts", [])),
            "action_items": len(report.get("action_items", [])),
        }
    except Exception as e:
        result["weekly_report"] = {"ok": False, "msg": str(e)}

    # ── 요약 ─────────────────────────────────────────────────
    services = ["gmail", "google_calendar", "google_sheets", "slack", "scheduler"]
    ok_count = sum(1 for s in services if result.get(s, {}).get("ok"))
    result["_summary"] = {
        "checked_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "healthy": ok_count,
        "total": len(services),
        "status": "All systems operational" if ok_count == len(services) else f"{ok_count}/{len(services)} services OK",
    }

    return result
