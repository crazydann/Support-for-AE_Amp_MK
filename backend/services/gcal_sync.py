"""
Google Calendar API 동기화 - 최근 미팅을 계정별 activity_history에 추가
"""
import logging
from datetime import datetime, timedelta, timezone
from googleapiclient.discovery import build

from .google_auth import get_google_credentials
from .account_keywords import match_account

logger = logging.getLogger(__name__)

# 내부 전용 미팅 제목 패턴 - 스킵
INTERNAL_SKIP_KEYWORDS = [
    "focus time", "clockwise", "forecast", "1:1", "standup",
    "all hands", "오피스 아워", "개인",
]


def _is_internal_event(summary: str) -> bool:
    s = summary.lower()
    return any(kw in s for kw in INTERNAL_SKIP_KEYWORDS)


def fetch_recent_meetings(days_back: int = 14, processed_ids: set = None) -> list[dict]:
    """
    최근 N일간 캘린더 이벤트에서 계정 관련 미팅 추출.
    Returns: list of activity entries
    """
    if processed_ids is None:
        processed_ids = set()

    creds = get_google_credentials()
    if not creds:
        logger.info("Calendar sync 건너뜀 (Google OAuth 미설정)")
        return []

    try:
        service = build("calendar", "v3", credentials=creds)

        now = datetime.now(timezone.utc)
        time_min = (now - timedelta(days=days_back)).isoformat()
        time_max = now.isoformat()

        events_result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=200,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = events_result.get("items", [])
        activities = []

        for event in events:
            event_id = event.get("id", "")
            source_id = f"gcal_{event_id}"

            if source_id in processed_ids:
                continue

            summary = event.get("summary", "")
            if not summary or _is_internal_event(summary):
                continue

            # 참석자 이메일 수집
            attendees = event.get("attendees", [])
            attendee_emails = " ".join(a.get("email", "") for a in attendees)
            description = event.get("description", "") or ""

            search_text = f"{summary} {attendee_emails} {description}"
            account = match_account(search_text)
            if not account:
                continue

            # 날짜
            start = event.get("start", {})
            date_str = start.get("dateTime", start.get("date", ""))[:10]

            # 참석자 이름 요약 (외부 참석자)
            external_attendees = [
                a.get("displayName") or a.get("email", "").split("@")[0]
                for a in attendees
                if "amplitude.com" not in a.get("email", "")
                and "ab180.co" not in a.get("email", "")
            ]
            attendee_str = ", ".join(external_attendees[:3])
            if len(external_attendees) > 3:
                attendee_str += f" 외 {len(external_attendees)-3}명"

            short_title = summary[:50] + ("..." if len(summary) > 50 else "")
            attendee_part = f" ({attendee_str})" if attendee_str else ""

            # description에서 핵심 텍스트 추출 (HTML 태그 제거, 첫 200자)
            desc_clean = ""
            if description:
                import re as _re
                desc_clean = _re.sub(r"<[^>]+>", "", description).strip()
                desc_clean = " ".join(desc_clean.split())[:200]

            summary_ko = f"[미팅] {short_title}{attendee_part}"
            summary_en = f"[Meeting] {short_title}{attendee_part}"
            if desc_clean:
                summary_ko += f" — {desc_clean}"
                summary_en += f" — {desc_clean}"

            activities.append({
                "account": account,
                "date": date_str,
                "type": "meeting",
                "source_id": source_id,
                "summary": summary_ko[:300],
                "summary_en": summary_en[:300],
            })

        logger.info(f"Calendar sync: {len(activities)}개 미팅 추출 (총 {len(events)}개 이벤트 검색)")
        return activities

    except Exception as e:
        logger.error(f"Calendar API 오류: {e}")
        return []
