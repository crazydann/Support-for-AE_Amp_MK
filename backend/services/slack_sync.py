"""
Slack API 동기화 - 최근 메시지를 계정별 activity_history에 추가
SLACK_USER_TOKEN (xoxp-) 또는 SLACK_BOT_TOKEN (xoxb-) 환경변수 필요

우선순위:
  1. slack_channels.json에 정의된 채널 ID로 conversations.history 읽기 (정확)
  2. user token이면 search.messages로 키워드 검색 (보완)
"""
import json
import os
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .account_keywords import match_account, ACCOUNT_KEYWORDS

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
SLACK_CHANNELS_FILE = DATA_DIR / "slack_channels.json"

# 키워드 기반 검색 fallback (채널 매핑 없는 계정용)
SLACK_SEARCH_KEYWORDS = {
    "TVING": ["TVING", "티빙"],
    "CJ Olive Young": ["올리브영", "olive young"],
    "하이마트": ["하이마트", "himart"],
    "Lotte Shopping": ["롯데온", "마티니"],
    "Starbucks Korea": ["스타벅스", "starbucks"],
    "LG Uplus (CTO)": ["uplus", "유플러스"],
    "SPC (Secta9ine)": ["SPC", "secta9ine"],
    "Golfzon County": ["골프존", "golfzon"],
    "야놀자 (NOL Universe)": ["야놀자", "yanolja"],
    "인터파크트리플": ["인터파크", "interpark"],
}


def _load_channel_map() -> dict[str, list[dict]]:
    """slack_channels.json에서 계정별 채널 목록 반환"""
    if not SLACK_CHANNELS_FILE.exists():
        return {}
    data = json.loads(SLACK_CHANNELS_FILE.read_text(encoding="utf-8"))
    result = {}
    for ch in data.get("channels", []):
        acc = ch.get("account")
        if not acc or acc.startswith("_"):
            continue
        if acc not in result:
            result[acc] = []
        result[acc].append(ch)
    return result


def fetch_recent_slack_messages(days_back: int = 14, processed_ids: set = None) -> list[dict]:
    """
    Slack에서 계정 관련 최근 메시지 추출.
    1단계: slack_channels.json의 채널 ID로 conversations.history 직접 읽기
    2단계: user token이면 search.messages로 키워드 검색 보완
    """
    if processed_ids is None:
        processed_ids = set()

    token = os.environ.get("SLACK_USER_TOKEN") or os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        logger.info("Slack sync 건너뜀 (SLACK_USER_TOKEN 또는 SLACK_BOT_TOKEN 미설정)")
        return []

    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError

        client = WebClient(token=token)

        now = datetime.now(timezone.utc)
        oldest_ts = str((now - timedelta(days=days_back)).timestamp())

        activities = []
        channel_map = _load_channel_map()

        # ── 1단계: 채널 ID 기반 직접 읽기 ─────────────────────────────
        processed_channels = set()
        for account, channels in channel_map.items():
            for ch in channels:
                channel_id = ch.get("channel_id")
                if not channel_id or channel_id in processed_channels:
                    continue
                processed_channels.add(channel_id)

                try:
                    result = client.conversations_history(
                        channel=channel_id,
                        oldest=oldest_ts,
                        limit=20,
                    )
                    messages = result.get("messages", [])
                    for msg in messages:
                        ts = msg.get("ts", "")
                        source_id = f"slack_{ts}"
                        if source_id in processed_ids:
                            continue

                        text = msg.get("text", "").strip()
                        if not text or len(text) < 5:
                            continue

                        # 봇 메시지 / 시스템 메시지 스킵
                        if msg.get("subtype") in ("channel_join", "channel_leave", "bot_message"):
                            continue

                        ts_float = float(ts) if ts else 0
                        date_str = datetime.fromtimestamp(ts_float, tz=timezone.utc).strftime("%Y-%m-%d")
                        channel_name = ch.get("channel_name", channel_id)
                        text_short = text[:100]

                        summary = f"[슬랙] #{channel_name}: {text_short}"
                        summary_en = f"[Slack] #{channel_name}: {text_short}"

                        activities.append({
                            "account": account,
                            "date": date_str,
                            "type": "slack",
                            "source_id": source_id,
                            "summary": summary[:150],
                            "summary_en": summary_en[:150],
                        })

                except SlackApiError as e:
                    logger.debug(f"conversations.history 오류 ({channel_id}): {e}")
                    continue

        # ── 2단계: user token으로 search.messages 키워드 검색 보완 ─────
        if token.startswith("xoxp-"):
            # 이미 채널 매핑으로 처리된 계정은 중복 검색 안 함
            mapped_accounts = set(channel_map.keys())

            for account, keywords in SLACK_SEARCH_KEYWORDS.items():
                if account in mapped_accounts:
                    continue  # 채널 매핑 있으면 스킵

                for kw in keywords[:1]:  # 계정당 1개 키워드만
                    try:
                        search_result = client.search_messages(
                            query=f"{kw} after:{(now - timedelta(days=days_back)).strftime('%Y-%m-%d')}",
                            count=5,
                        )
                        matches = search_result.get("messages", {}).get("matches", [])
                        for match in matches:
                            ts = match.get("ts", "")
                            source_id = f"slack_{ts}"
                            if source_id in processed_ids:
                                continue

                            ts_float = float(ts) if ts else 0
                            if ts_float < float(oldest_ts):
                                continue

                            date_str = datetime.fromtimestamp(ts_float, tz=timezone.utc).strftime("%Y-%m-%d")
                            text = match.get("text", "")[:100]
                            username = match.get("username") or match.get("user", "")
                            channel_name = match.get("channel", {}).get("name", "")

                            summary = f"[슬랙] #{channel_name} {username}: {text}"
                            summary_en = f"[Slack] #{channel_name} {username}: {text}"

                            activities.append({
                                "account": account,
                                "date": date_str,
                                "type": "slack",
                                "source_id": source_id,
                                "summary": summary[:150],
                                "summary_en": summary_en[:150],
                            })
                    except SlackApiError as e:
                        logger.debug(f"Slack search 오류 ({kw}): {e}")
                        continue

        logger.info(f"Slack sync: {len(activities)}개 메시지 추출 (채널직접: {len(processed_channels)}개 채널)")
        return activities

    except ImportError:
        logger.warning("slack_sdk 미설치. 'pip install slack-sdk' 실행 필요")
        return []
    except Exception as e:
        logger.error(f"Slack API 오류: {e}")
        return []
