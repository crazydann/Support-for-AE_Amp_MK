"""
Glean Sync Service
==================
Claude Code가 Glean MCP로 검색한 결과를 받아 intel_log에 저장.
- SFDC Opportunity, Contact 업데이트
- 내부 문서/이메일/Slack 메시지
- 중복 방지 (source_id 기반)

entry 형식:
  {
    "account":   str,       # key_account 값과 일치해야 함
    "title":     str,       # 문서/메시지 제목
    "summary":   str,       # 요약 내용
    "url":       str,       # 원문 링크 (선택)
    "date":      str,       # YYYY-MM-DD
    "type":      str,       # sfdc | gmail | slack | doc | etc
    "source_id": str,       # 중복 방지용 고유 ID
  }
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR        = Path(__file__).parent.parent / "data"
SYNC_STATE_FILE = DATA_DIR / "glean_sync_state.json"


# ══════════════════════════════════════════════════════════════
# 상태 파일 헬퍼
# ══════════════════════════════════════════════════════════════

def _load_state() -> dict:
    """glean_sync_state.json 읽기. 없으면 빈 상태 반환."""
    if not SYNC_STATE_FILE.exists():
        return {"processed_ids": [], "last_run": None, "total_added": 0}
    try:
        return json.loads(SYNC_STATE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"glean_sync_state.json 읽기 실패: {e}")
        return {"processed_ids": [], "last_run": None, "total_added": 0}


def _save_state(state: dict) -> None:
    """glean_sync_state.json 저장."""
    try:
        DATA_DIR.mkdir(exist_ok=True)
        SYNC_STATE_FILE.write_text(
            json.dumps(state, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    except Exception as e:
        logger.error(f"glean_sync_state.json 저장 실패: {e}")


# ══════════════════════════════════════════════════════════════
# 메인 ingest 함수
# ══════════════════════════════════════════════════════════════

def ingest_glean_results(entries: list[dict]) -> dict:
    """
    Glean 검색 결과를 일괄 처리해서 intel_log에 저장.

    Args:
        entries: Glean 결과 목록. 각 항목은 account, title, summary,
                 url, date, type, source_id 필드를 포함해야 함.

    Returns:
        {"added": int, "skipped": int, "errors": int}
    """
    from . import intel_memory_service as mem
    import asyncio

    state        = _load_state()
    processed_ids: set = set(state.get("processed_ids", []))

    added   = 0
    skipped = 0
    errors  = 0

    for entry in entries:
        source_id = entry.get("source_id", "")

        # 중복 체크
        if source_id and source_id in processed_ids:
            skipped += 1
            continue

        # 필드 정제
        account  = (entry.get("account") or "").strip()
        title    = (entry.get("title")   or "").strip()
        summary  = (entry.get("summary") or "").strip()
        url      = (entry.get("url")     or "").strip()
        date_str = (entry.get("date")    or datetime.now(timezone.utc).strftime("%Y-%m-%d")).strip()
        etype    = (entry.get("type")    or "glean").strip()

        # summary 구성: 제목 + 요약 + URL
        parts = []
        if title:
            parts.append(f"[{title}]")
        if summary:
            parts.append(summary)
        if url:
            parts.append(f"({url})")
        log_summary = " ".join(parts) if parts else "(내용 없음)"
        log_summary = f"[Glean/{etype}] {log_summary}"

        # intel_log에 append (동기 방식으로 호출)
        # gmail/meeting/slack 타입은 그대로 유지 → weekly-feed에서 올바르게 표시
        NATIVE_TYPES = {"gmail", "meeting", "slack", "memo"}
        final_type = etype if etype in NATIVE_TYPES else f"glean_{etype}"
        try:
            loop = asyncio.new_event_loop()
            ok = loop.run_until_complete(
                mem.append_log(
                    summary=log_summary,
                    log_type=final_type,
                    account=account or None,
                    source="glean",
                )
            )
            loop.close()

            if ok:
                if source_id:
                    processed_ids.add(source_id)
                added += 1
            else:
                errors += 1
        except Exception as e:
            logger.error(f"intel_log 추가 실패 (source_id={source_id}): {e}")
            errors += 1

    # 상태 업데이트
    state["processed_ids"] = list(processed_ids)
    state["last_run"]      = datetime.now(timezone.utc).isoformat()
    state["total_added"]   = state.get("total_added", 0) + added
    _save_state(state)

    logger.info(f"Glean ingest 완료: added={added}, skipped={skipped}, errors={errors}")
    return {"added": added, "skipped": skipped, "errors": errors}


def get_sync_status() -> dict:
    """현재 glean_sync_state.json 내용 반환."""
    state = _load_state()
    return {
        "last_run":      state.get("last_run"),
        "total_added":   state.get("total_added", 0),
        "processed_count": len(state.get("processed_ids", [])),
    }
