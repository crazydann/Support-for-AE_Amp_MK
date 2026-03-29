"""
Slack API 동기화 - 최근 메시지를 계정별 activity_history에 추가
SLACK_BOT_TOKEN 환경변수 필요 (xoxb- 또는 xoxp- 토큰)
"""
import os
import logging
from datetime import datetime, timedelta, timezone

from .account_keywords import match_account, ACCOUNT_KEYWORDS

logger = logging.getLogger(__name__)

# 검색할 계정 키워드 (Slack search에 쓸 핵심 키워드만)
SLACK_SEARCH_KEYWORDS = {
    "TVING": ["TVING", "티빙"],
    "CJ Olive Young": ["올리브영", "olive young"],
    "하이마트": ["하이마트", "himart"],
    "Lotte Shopping": ["롯데온", "마티니"],
    "Starbucks Korea": ["스타벅스", "starbucks"],
    "LG Uplus (CTO)": ["uplus", "유플러스"],
    "Nolbal": ["놀발", "nolbal"],
    "SPC (Secta9ine)": ["SPC", "secta9ine", "섹나나인"],
}


def fetch_recent_slack_messages(days_back: int = 14, processed_ids: set = None) -> list[dict]:
    """
    Slack에서 계정 관련 최근 메시지 추출.
    SLACK_BOT_TOKEN 환경변수가 필요합니다.
    xoxp- (user token) 사용 시 search.messages API 활용
    xoxb- (bot token) 사용 시 특정 채널만 읽기 가능
    """
    if processed_ids is None:
        processed_ids = set()

    token = os.environ.get("SLACK_BOT_TOKEN") or os.environ.get("SLACK_USER_TOKEN")
    if not token:
        logger.info("Slack sync 건너뜀 (SLACK_BOT_TOKEN 또는 SLACK_USER_TOKEN 미설정)")
        return []

    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError

        client = WebClient(token=token)

        now = datetime.now(timezone.utc)
        oldest = (now - timedelta(days=days_back)).timestamp()

        activities = []

        # User token이면 search.messages 사용 (더 강력)
        if token.startswith("xoxp-"):
            for account, keywords in SLACK_SEARCH_KEYWORDS.items():
                for kw in keywords[:1]:  # 계정당 1개 키워드만
                    try:
                        result = client.search_messages(
                            query=f"{kw} after:{(now - timedelta(days=days_back)).strftime('%Y-%m-%d')}",
                            count=10,
                        )
                        matches = result.get("messages", {}).get("matches", [])
                        for match in matches:
                            ts = match.get("ts", "")
                            source_id = f"slack_{ts}"
                            if source_id in processed_ids:
                                continue

                            ts_float = float(ts) if ts else 0
                            if ts_float < oldest:
                                continue

                            date_str = datetime.fromtimestamp(ts_float).strftime("%Y-%m-%d")
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
                                "summary": summary[:120],
                                "summary_en": summary_en[:120],
                            })
                    except SlackApiError as e:
                        logger.debug(f"Slack search 오류 ({kw}): {e}")
                        continue

        logger.info(f"Slack sync: {len(activities)}개 메시지 추출")
        return activities

    except ImportError:
        logger.warning("slack_sdk 미설치. 'pip install slack-sdk' 실행 필요")
        return []
    except Exception as e:
        logger.error(f"Slack API 오류: {e}")
        return []
