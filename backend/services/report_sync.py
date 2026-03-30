"""
Report Sync 오케스트레이터
Gmail + Calendar + Slack에서 데이터를 수집해 weekly_report.json의
activity_history를 업데이트합니다.
strategy/deal_stage/notes_summary 등 AI 분석 필드는 건드리지 않습니다.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from .gmail_sync import fetch_recent_emails
from .gcal_sync import fetch_recent_meetings
from .slack_sync import fetch_recent_slack_messages

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
REPORT_FILE = DATA_DIR / "weekly_report.json"
SYNC_STATE_FILE = DATA_DIR / "sync_state.json"

SYNC_INTERVAL_HOURS = 6  # 이 시간 이내 sync는 스킵


def _read_report() -> dict:
    if not REPORT_FILE.exists():
        return {"accounts": []}
    return json.loads(REPORT_FILE.read_text(encoding="utf-8"))


def _write_report(data: dict):
    REPORT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_sync_state() -> dict:
    if not SYNC_STATE_FILE.exists():
        return {"last_sync": None, "processed_ids": []}
    return json.loads(SYNC_STATE_FILE.read_text(encoding="utf-8"))


def _write_sync_state(state: dict):
    SYNC_STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _should_sync(state: dict) -> bool:
    """마지막 sync 후 SYNC_INTERVAL_HOURS 이상 경과했으면 True"""
    last_sync = state.get("last_sync")
    if not last_sync:
        return True
    try:
        last_dt = datetime.fromisoformat(last_sync)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        elapsed_hours = (datetime.now(timezone.utc) - last_dt).total_seconds() / 3600
        return elapsed_hours >= SYNC_INTERVAL_HOURS
    except Exception:
        return True


def run_sync(force: bool = False) -> dict:
    """
    전체 sync 실행.
    force=True이면 interval 무시하고 강제 실행.
    Returns: {"added": int, "skipped": bool, "error": str | None}
    """
    state = _read_sync_state()

    if not force and not _should_sync(state):
        logger.info(f"Sync 스킵 (마지막 sync: {state.get('last_sync')})")
        return {"added": 0, "skipped": True, "error": None}

    processed_ids = set(state.get("processed_ids", []))
    all_activities: list[dict] = []

    # 데이터 수집
    try:
        emails = fetch_recent_emails(days_back=14, processed_ids=processed_ids)
        all_activities.extend(emails)
    except Exception as e:
        logger.error(f"Gmail sync 오류: {e}")

    try:
        meetings = fetch_recent_meetings(days_back=14, processed_ids=processed_ids)
        all_activities.extend(meetings)
    except Exception as e:
        logger.error(f"Calendar sync 오류: {e}")

    try:
        slack_msgs = fetch_recent_slack_messages(days_back=14, processed_ids=processed_ids)
        all_activities.extend(slack_msgs)
    except Exception as e:
        logger.error(f"Slack sync 오류: {e}")

    if not all_activities:
        # sync 성공했지만 새 데이터 없음
        state["last_sync"] = datetime.now(timezone.utc).isoformat()
        _write_sync_state(state)
        return {"added": 0, "skipped": False, "error": None}

    # report에 추가
    report = _read_report()
    accounts = {acc["key_account"]: acc for acc in report.get("accounts", [])}

    added_count = 0
    new_ids: list[str] = []

    for activity in all_activities:
        account_name = activity.get("account")
        if not account_name or account_name not in accounts:
            continue

        source_id = activity.get("source_id", "")
        if source_id in processed_ids:
            continue

        acc = accounts[account_name]
        history = acc.setdefault("activity_history", [])

        # 중복 체크 (source_id 기반)
        existing_ids = {h.get("source_id", "") for h in history}
        if source_id in existing_ids:
            continue

        # activity_history entry 생성 (source_id 포함)
        entry = {
            "date": activity["date"],
            "type": activity["type"],
            "source_id": source_id,
            "summary": activity["summary"],
            "summary_en": activity["summary_en"],
        }
        history.append(entry)

        # last_activity 업데이트 (더 최신이면)
        current_last = acc.get("last_activity", "")
        if activity["date"] > current_last:
            acc["last_activity"] = activity["date"]

        new_ids.append(source_id)
        added_count += 1

        # ── Intel Log에도 자동 기록 ──
        try:
            from .intel_memory_service import _sync_append_log
            from datetime import timezone as _tz
            _sync_append_log({
                "ts":      __import__("datetime").datetime.now(_tz.utc).isoformat(),
                "date":    activity["date"],
                "type":    activity["type"],     # gmail | slack
                "account": account_name,
                "summary": activity["summary"],
                "source":  activity["type"],     # gmail | slack
            })
        except Exception:
            pass

    # activity_history 날짜 내림차순 정렬
    for acc in accounts.values():
        acc["activity_history"] = sorted(
            acc.get("activity_history", []),
            key=lambda x: x.get("date", ""),
            reverse=True,
        )

    # 저장
    report["accounts"] = list(accounts.values())
    _write_report(report)

    # sync 상태 업데이트 (processed_ids 최대 2000개 유지)
    all_processed = list(processed_ids) + new_ids
    state["processed_ids"] = all_processed[-2000:]
    state["last_sync"] = datetime.now(timezone.utc).isoformat()
    _write_sync_state(state)

    logger.info(f"Sync 완료: {added_count}개 활동 추가")
    return {"added": added_count, "skipped": False, "error": None}


async def run_sync_async(force: bool = False) -> dict:
    """비동기 래퍼 (FastAPI endpoint용)"""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: run_sync(force=force))
