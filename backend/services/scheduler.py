"""
Daily Auto-Update Scheduler
===========================
매일 오전 5시 (KST = UTC 20:00) 자동 실행:
  1. Gmail / Calendar / Slack 동기화
  2. Intel Log → Account Memory 합성
  3. 전체 계정 weekly_report 업데이트

FastAPI lifespan에서 AsyncIOScheduler로 등록됨.
"""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def daily_update_job():
    """
    매일 오전 5시 KST 자동 실행되는 전체 업데이트 잡.
    단계: sync → synthesis → 로그
    """
    start_ts = datetime.now(timezone.utc).isoformat()
    logger.info(f"[Scheduler] ▶ Daily update started at {start_ts} UTC (5 AM KST)")

    results = {
        "started_at": start_ts,
        "sync": None,
        "synthesis": None,
        "errors": [],
    }

    # ── 1단계: 데이터 동기화 (Gmail / Calendar / Slack) ──────────────
    try:
        from .report_sync import run_sync_async
        sync_result = await run_sync_async(force=True)
        results["sync"] = sync_result
        logger.info(f"[Scheduler] ✓ Sync done — added={sync_result.get('added', 0)}")
    except Exception as e:
        msg = f"Sync failed: {e}"
        results["errors"].append(msg)
        logger.error(f"[Scheduler] ✗ {msg}")

    # 잠시 대기 (sync 후 파일 write 완료 보장)
    await asyncio.sleep(2)

    # ── 2단계: Intel Log → Account Memory 합성 ───────────────────────
    try:
        from . import synthesis_service as synth
        loop = asyncio.get_event_loop()
        synth_result = await loop.run_in_executor(None, synth.run_full_synthesis, 60)
        results["synthesis"] = synth_result
        logger.info(f"[Scheduler] ✓ Synthesis done — {synth_result}")
    except Exception as e:
        msg = f"Synthesis failed: {e}"
        results["errors"].append(msg)
        logger.error(f"[Scheduler] ✗ {msg}")

    # ── 3단계: 완료 로그 기록 (intel_log에 시스템 이벤트 추가) ────────
    try:
        from . import intel_memory_service as mem
        error_summary = f" (오류: {len(results['errors'])}건)" if results["errors"] else ""
        await mem.append_log(
            summary=f"[자동 업데이트] 일일 싱크 완료{error_summary} — "
                    f"추가 {results.get('sync', {}).get('added', 0)}건",
            log_type="system",
            account=None,
            source="scheduler",
        )
    except Exception as e:
        logger.error(f"[Scheduler] Log append failed: {e}")

    end_ts = datetime.now(timezone.utc).isoformat()
    logger.info(f"[Scheduler] ■ Daily update finished at {end_ts}")
    return results
