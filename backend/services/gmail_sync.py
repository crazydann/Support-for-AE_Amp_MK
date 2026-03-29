"""
Gmail API 동기화 - 최근 이메일을 계정별 activity_history에 추가
"""
import logging
import base64
import re
from datetime import datetime, timezone
from googleapiclient.discovery import build

from .google_auth import get_google_credentials
from .account_keywords import match_account, INTERNAL_DOMAINS

logger = logging.getLogger(__name__)


def _decode_body(payload: dict) -> str:
    """이메일 본문 디코딩 (plain text 우선)"""
    if payload.get("mimeType") == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")

    for part in payload.get("parts", []):
        result = _decode_body(part)
        if result:
            return result
    return ""


def _parse_email_address(header_value: str) -> tuple[str, str]:
    """'이름 <email>' 형식에서 이름과 이메일 추출"""
    match = re.match(r'"?([^"<]+)"?\s*<([^>]+)>', header_value)
    if match:
        return match.group(1).strip(), match.group(2).strip().lower()
    return "", header_value.strip().lower()


def _is_internal(email: str) -> bool:
    """Amplitude 내부 이메일 여부"""
    return any(domain in email.lower() for domain in INTERNAL_DOMAINS)


def _get_header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def fetch_recent_emails(days_back: int = 14, processed_ids: set = None) -> list[dict]:
    """
    최근 N일간 이메일에서 계정 관련 항목 추출.
    Returns: list of activity entries
    {
        account: str,
        date: str (YYYY-MM-DD),
        type: "email",
        source_id: str (gmail message id),
        summary: str,
        summary_en: str,
    }
    """
    if processed_ids is None:
        processed_ids = set()

    creds = get_google_credentials()
    if not creds:
        logger.info("Gmail sync 건너뜀 (Google OAuth 미설정)")
        return []

    try:
        service = build("gmail", "v1", credentials=creds)
        query = f"after:{days_back}d"
        results = service.users().messages().list(
            userId="me", q=query, maxResults=100
        ).execute()

        messages = results.get("messages", [])
        activities = []

        for msg_ref in messages:
            msg_id = msg_ref["id"]
            if msg_id in processed_ids:
                continue

            try:
                msg = service.users().messages().get(
                    userId="me", id=msg_id, format="metadata",
                    metadataHeaders=["From", "To", "Cc", "Subject", "Date"]
                ).execute()

                headers = msg.get("payload", {}).get("headers", [])
                subject = _get_header(headers, "Subject")
                from_raw = _get_header(headers, "From")
                to_raw = _get_header(headers, "To")
                cc_raw = _get_header(headers, "Cc")
                date_raw = _get_header(headers, "Date")

                # 검색 텍스트 조합
                search_text = f"{subject} {from_raw} {to_raw} {cc_raw}"

                account = match_account(search_text)
                if not account:
                    continue

                # 날짜 파싱
                try:
                    from email.utils import parsedate_to_datetime
                    dt = parsedate_to_datetime(date_raw)
                    date_str = dt.strftime("%Y-%m-%d")
                except Exception:
                    ts = int(msg.get("internalDate", 0)) / 1000
                    date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")

                # 발신자 이름
                sender_name, sender_email = _parse_email_address(from_raw)
                display_name = sender_name or sender_email.split("@")[0]

                # 요약 생성 (AI 없이 템플릿)
                short_subject = subject[:60] + ("..." if len(subject) > 60 else "")
                summary = f"[이메일] {display_name}: {short_subject}"
                summary_en = f"[Email] {display_name}: {short_subject}"

                activities.append({
                    "account": account,
                    "date": date_str,
                    "type": "email",
                    "source_id": f"gmail_{msg_id}",
                    "summary": summary,
                    "summary_en": summary_en,
                })

            except Exception as e:
                logger.debug(f"메시지 {msg_id} 처리 오류: {e}")
                continue

        logger.info(f"Gmail sync: {len(activities)}개 활동 추출 (총 {len(messages)}개 메시지 검색)")
        return activities

    except Exception as e:
        logger.error(f"Gmail API 오류: {e}")
        return []
