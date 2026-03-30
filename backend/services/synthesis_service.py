"""
Synthesis Service
=================
Intel Log를 읽고 계정별 전략 인사이트를 합성.

두 가지 모드:
  - rule_based: 패턴 분석 (API 키 불필요, 항상 동작)
  - llm: ANTHROPIC_API_KEY 설정 시 Claude API로 고품질 합성

호출 방법:
  - POST /api/intel/synthesize        → 전체 계정 합성
  - POST /api/intel/synthesize/{account} → 특정 계정만
  - "메모리 업데이트 해줘" 명령 시 자동 호출
"""
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
REPORT_FILE = DATA_DIR / "weekly_report.json"
INTEL_LOG_FILE = DATA_DIR / "intel_log.jsonl"

# ── 플레이북 상수 ──────────────────────────────────────────────
PLAYBOOK = {
    "group_mtu": "그룹사는 전체 MTU 계약 + 하위 프로젝트 구조 제안",
    "upsell_path": ["Event → MTU 전환", "MTU → Experiment Add-on", "MTU → Activation Add-on"],
    "focus_2026": "Experiment Add-on 크로스셀 (MTU 전환 완료 Enterprise 고객 우선)",
    "experiment_targets": ["Musinsa", "Dunamu", "GS Retail", "TVING", "CJ Olive Young", "Lotte Shopping"],
    "renewal_warning_days": 90,
    "urgent_days": 60,
}


# ══════════════════════════════════════════════════════════════
# 내부 헬퍼
# ══════════════════════════════════════════════════════════════

def _read_report() -> dict:
    if not REPORT_FILE.exists():
        return {"generated_at": None, "accounts": [], "action_items": [], "risks": []}
    try:
        return json.loads(REPORT_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"weekly_report.json 읽기 실패: {e}")
        return {"generated_at": None, "accounts": [], "action_items": [], "risks": []}


def _write_report(report: dict) -> bool:
    try:
        REPORT_FILE.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        return True
    except Exception as e:
        logger.error(f"weekly_report.json 쓰기 실패: {e}")
        return False


def _read_intel_log(account: Optional[str] = None, days: int = 60) -> list:
    """intel_log.jsonl에서 계정 + 기간 필터링 읽기 (동기)."""
    if not INTEL_LOG_FILE.exists():
        return []
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


def _days_until(date_str: Optional[str]) -> Optional[int]:
    """날짜 문자열(YYYY-MM-DD)까지 남은 일수."""
    if not date_str:
        return None
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return (target - now).days
    except Exception:
        return None


def _is_similar_action(existing: str, new_action: str) -> bool:
    """두 액션 텍스트가 유사한지 판단 (중복 방지)."""
    if not existing or not new_action:
        return False
    # 양쪽 모두 소문자화하고 핵심 키워드 20자 비교
    e_lower = existing.lower().replace(" ", "")[:30]
    n_lower = new_action.lower().replace(" ", "")[:30]
    # 첫 20자가 같으면 유사
    return e_lower[:20] == n_lower[:20]


# ══════════════════════════════════════════════════════════════
# 핵심 합성 함수
# ══════════════════════════════════════════════════════════════

def synthesize_account(account_name: str, days: int = 60) -> dict:
    """
    특정 계정의 intel_log 분석 + weekly_report 현황 → 인사이트 합성.

    Returns:
        {
          account: str,
          insights: list[str],
          recommended_actions: list[dict],
          risks: list[dict],
          strategy_update: str,
        }
    """
    entries = _read_intel_log(account=account_name, days=days)
    report = _read_report()

    # 해당 계정 데이터 찾기
    account_data = next(
        (a for a in report.get("accounts", []) if a.get("key_account") == account_name),
        None,
    )

    insights = []
    recommended_actions = []
    risks = []

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc)

    # ── 1. 활동 빈도 / 타입 집계 ──────────────────────────────
    type_counts = {}
    recent_7d_count = 0
    sent_email_count = 0

    for e in entries:
        t = e.get("type", "etc")
        type_counts[t] = type_counts.get(t, 0) + 1

        # 최근 7일 이벤트
        entry_date = e.get("date", "")
        if entry_date:
            try:
                d = datetime.strptime(entry_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if (today - d).days <= 7:
                    recent_7d_count += 1
            except Exception:
                pass

        # 발신 메일 카운트 (gmail + [발신] 키워드)
        summary = e.get("summary", "")
        if t in ("gmail", "email") and ("[발신]" in summary or "sent" in summary.lower()):
            sent_email_count += 1

    if recent_7d_count > 0:
        insights.append(f"최근 7일 내 {recent_7d_count}건 활동 — 활발한 딜 진행 중")

    if sent_email_count >= 3:
        insights.append(f"발신 메일 {sent_email_count}건 — 적극 영업 진행 중")

    total_entries = len(entries)
    if total_entries > 0:
        type_summary = ", ".join(f"{t} {c}건" for t, c in type_counts.items())
        insights.append(f"최근 {days}일 활동: {type_summary} (총 {total_entries}건)")

    memo_count = type_counts.get("memo", 0)
    if memo_count >= 2:
        insights.append(f"메모 {memo_count}건 — 활성 딜 진행 신호")

    # ── 2. 계정 데이터 기반 분석 (weekly_report 참조) ─────────
    if account_data:
        status = account_data.get("status", "active")
        health = account_data.get("health", "gray")
        subscription_end = account_data.get("subscription_end")
        amplitude_plan = account_data.get("amplitude_plan", "")
        arr = account_data.get("arr")
        group = account_data.get("group", "")

        days_left = _days_until(subscription_end)

        # D-day 계산 → 갱신 액션
        if days_left is not None and subscription_end:
            if days_left <= 0:
                risks.append({
                    "account": account_name,
                    "risk": f"계약 만료됨 (만료일: {subscription_end}). 즉시 갱신 조치 필요.",
                    "risk_en": f"Contract expired ({subscription_end}). Immediate renewal action required.",
                })
                recommended_actions.append({
                    "priority": "urgent",
                    "account": account_name,
                    "group": group,
                    "action": f"[합성] {account_name} 계약 만료 — 즉시 갱신 처리 필요",
                    "action_en": f"[Synthesis] {account_name} contract expired — immediate renewal required",
                    "due": today_str,
                })
            elif days_left <= PLAYBOOK["urgent_days"]:
                risks.append({
                    "account": account_name,
                    "risk": f"D-{days_left} 갱신 임박. 갱신 협상 즉시 착수 필요.",
                    "risk_en": f"D-{days_left} renewal approaching. Immediate negotiation required.",
                })
                recommended_actions.append({
                    "priority": "urgent",
                    "account": account_name,
                    "group": group,
                    "action": f"[합성] {account_name} D-{days_left} 갱신 긴급 — EB 컨펌 및 조건 협의 착수",
                    "action_en": f"[Synthesis] {account_name} D-{days_left} urgent renewal — start EB confirmation and negotiation",
                    "due": subscription_end,
                })
            elif days_left <= PLAYBOOK["renewal_warning_days"]:
                insights.append(f"D-{days_left} 갱신 준비 필요 (만료: {subscription_end})")
                recommended_actions.append({
                    "priority": "high",
                    "account": account_name,
                    "group": group,
                    "action": f"[합성] {account_name} D-{days_left} 갱신 준비 착수 — QBR / 성과 리뷰 예약",
                    "action_en": f"[Synthesis] {account_name} D-{days_left} renewal prep — schedule QBR / success review",
                    "due": subscription_end,
                })

        # health red/orange → 긴급 액션
        if health == "red" and status == "active":
            risks.append({
                "account": account_name,
                "risk": "Health 레드 — 긴급 계정 관리 필요 (이탈 위험)",
                "risk_en": "Health RED — urgent account management needed (churn risk)",
            })
            recommended_actions.append({
                "priority": "urgent",
                "account": account_name,
                "group": group,
                "action": f"[합성] {account_name} Health RED — 이탈 위험 긴급 대응 및 경영진 에스컬레이션 검토",
                "action_en": f"[Synthesis] {account_name} Health RED — urgent churn prevention and exec escalation",
                "due": today_str,
            })
        elif health == "orange" and status == "active":
            insights.append("Health 오렌지 — 지속 모니터링 및 관계 강화 필요")

        # Experiment 타깃 계정 → 크로스셀 기회
        if account_name in PLAYBOOK["experiment_targets"] and amplitude_plan == "Enterprise":
            insights.append(
                f"2026 Experiment Add-on 크로스셀 타깃. Enterprise 플랜 → Experiment 도입 제안 우선 추진."
            )
            # 이미 Experiment 관련 최근 활동이 없으면 액션 추가
            has_experiment_activity = any(
                "experiment" in e.get("summary", "").lower()
                for e in entries
            )
            if not has_experiment_activity:
                recommended_actions.append({
                    "priority": "high",
                    "account": account_name,
                    "group": group,
                    "action": f"[합성] {account_name} Experiment Add-on 크로스셀 제안 — 데모 일정 잡기",
                    "action_en": f"[Synthesis] {account_name} Experiment Add-on cross-sell — schedule demo",
                    "due": "",
                })

        # 그룹사 MTU 전략 체크
        if group and amplitude_plan == "Growth":
            insights.append(
                f"Growth 플랜 계정 ({group} 그룹) — MTU 전환 업셀 기회 검토 필요."
            )

    # ── 3. 최근 인텔 메모 기반 인사이트 ──────────────────────
    if entries:
        latest = entries[0]
        latest_summary = latest.get("summary", "")
        if latest_summary:
            insights.append(f"최신 인텔: {latest_summary[:100]}")

    # ── 4. 전략 업데이트 텍스트 생성 ─────────────────────────
    strategy_parts = []
    if insights:
        strategy_parts.append(" | ".join(insights[:3]))
    if recommended_actions:
        action_texts = [a.get("action", "") for a in recommended_actions[:2]]
        strategy_parts.append("권장 액션: " + " / ".join(action_texts))

    strategy_update = "\n".join(strategy_parts) if strategy_parts else ""

    return {
        "account": account_name,
        "insights": insights,
        "recommended_actions": recommended_actions,
        "risks": risks,
        "strategy_update": strategy_update,
    }


def update_report_from_synthesis(synthesis_results: list) -> dict:
    """
    합성 결과 리스트를 받아 weekly_report.json 업데이트.

    - action_items에 새 액션 추가 (중복 방지)
    - risks에 새 리스크 추가 (중복 방지)
    - strategy_summary 업데이트 (활성 딜 하이라이트)
    - 기존 notes_summary, activity_history는 유지

    Returns: {"actions_added": N, "risks_updated": N}
    """
    report = _read_report()
    existing_actions = report.get("action_items", [])
    existing_risks = report.get("risks", [])

    actions_added = 0
    risks_updated = 0

    for result in synthesis_results:
        account_name = result.get("account", "")
        new_actions = result.get("recommended_actions", [])
        new_risks = result.get("risks", [])

        # ── action_items 추가 (중복 방지) ──
        for new_action in new_actions:
            new_text = new_action.get("action", "")
            # 같은 account의 기존 액션과 유사한 내용이면 스킵
            is_dup = any(
                ea.get("account") == account_name
                and _is_similar_action(ea.get("action", ""), new_text)
                for ea in existing_actions
            )
            if not is_dup and new_text:
                existing_actions.append(new_action)
                actions_added += 1

        # ── risks 추가 (중복 방지) ──
        for new_risk in new_risks:
            new_risk_text = new_risk.get("risk", "")
            is_dup = any(
                er.get("account") == account_name
                and _is_similar_action(er.get("risk", ""), new_risk_text)
                for er in existing_risks
            )
            if not is_dup and new_risk_text:
                existing_risks.append(new_risk)
                risks_updated += 1

    # ── strategy_summary 업데이트 ──
    active_accounts = [
        a for a in report.get("accounts", [])
        if a.get("status") == "active" and a.get("health") in ("red", "orange", "yellow")
    ]
    if active_accounts:
        highlights = []
        for acc in active_accounts[:4]:
            name = acc.get("key_account", "")
            health = acc.get("health", "")
            sub_end = acc.get("subscription_end")
            days_left = _days_until(sub_end)
            if health == "red":
                highlights.append(f"{name} 긴급")
            elif health == "orange" and days_left and days_left <= 90:
                highlights.append(f"{name} D-{days_left}")
            else:
                highlights.append(name)

        if highlights:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            new_summary = (
                f"[합성 업데이트 {today_str}] "
                f"주요 계정 현황: {', '.join(highlights)}. "
                f"합성 결과 {actions_added}건 액션, {risks_updated}건 리스크 추가."
            )
            new_summary_en = (
                f"[Synthesis {today_str}] "
                f"Key accounts: {', '.join(highlights)}. "
                f"{actions_added} actions and {risks_updated} risks added from synthesis."
            )
            # 기존 strategy_summary가 있으면 앞에 붙이기 (덮어쓰지 않음)
            existing_summary = report.get("strategy_summary", "")
            if existing_summary and not existing_summary.startswith("[합성"):
                report["strategy_summary"] = new_summary + " | " + existing_summary
                report["strategy_summary_en"] = new_summary_en + " | " + report.get("strategy_summary_en", "")
            else:
                report["strategy_summary"] = new_summary
                report["strategy_summary_en"] = new_summary_en

    report["action_items"] = existing_actions
    report["risks"] = existing_risks
    report["generated_at"] = datetime.now(timezone.utc).isoformat()

    _write_report(report)

    return {"actions_added": actions_added, "risks_updated": risks_updated}


def run_full_synthesis(days: int = 60) -> dict:
    """
    전체 계정 합성 실행:
    1. weekly_report.json에서 모든 계정 읽기
    2. 각 계정 synthesize_account 호출
    3. account_memory.json 업데이트
    4. weekly_report.json 업데이트

    Returns: {"synthesized": N, "actions_added": N, "risks_updated": N}
    """
    report = _read_report()
    accounts = report.get("accounts", [])

    if not accounts:
        logger.warning("weekly_report.json에 계정 없음 — 합성 스킵")
        return {"synthesized": 0, "actions_added": 0, "risks_updated": 0}

    synthesis_results = []
    synthesized_count = 0

    for acc in accounts:
        account_name = acc.get("key_account")
        if not account_name:
            continue

        try:
            result = synthesize_account(account_name, days=days)
            if result.get("insights") or result.get("recommended_actions") or result.get("risks"):
                synthesis_results.append(result)
                synthesized_count += 1

            # account_memory.json에 인사이트 저장
            strategy_update = result.get("strategy_update", "")
            if strategy_update:
                try:
                    from . import intel_memory_service as mem
                    import asyncio
                    # 동기 컨텍스트에서 비동기 함수 호출
                    loop = asyncio.new_event_loop()
                    loop.run_until_complete(
                        mem.append_memory(
                            account=account_name,
                            insight=strategy_update,
                            insight_type="synthesis",
                            source="synthesis_engine",
                        )
                    )
                    loop.close()
                except Exception as e:
                    logger.warning(f"account_memory 업데이트 실패 ({account_name}): {e}")

        except Exception as e:
            logger.error(f"계정 합성 실패 ({account_name}): {e}")
            continue

    # weekly_report.json 업데이트
    update_result = update_report_from_synthesis(synthesis_results)

    return {
        "synthesized": synthesized_count,
        "actions_added": update_result["actions_added"],
        "risks_updated": update_result["risks_updated"],
    }
