"""
Glean Sync Script
=================
Claude Code에서 실행:
  python backend/scripts/run_glean_sync.py

또는 Claude에게 "글린 동기화 해줘"라고 하면 Claude가 직접 Glean MCP로 각 계정을
검색 후 /api/intel/glean-ingest에 POST합니다.

검색 쿼리 패턴 (계정별):
  - salescloud: "{account_name} opportunity renewal" → SFDC 기회
  - salescloud: "{account_name} contact" → 담당자 변경
  - gmail: "{account_name}" → 최근 이메일
  - slack: "{account_name}" → 슬랙 메시지

Glean MCP 도구:
  mcp__204ac341-632f-4706-a119-4d2cff622378__search
  mcp__204ac341-632f-4706-a119-4d2cff622378__gmail_search

각 검색 결과를 아래 형식으로 변환 후 ingest()에 전달:
  {
    "account":   "<key_account 값>",
    "title":     "<문서/메시지 제목>",
    "summary":   "<내용 요약>",
    "url":       "<원문 URL>",
    "date":      "<YYYY-MM-DD>",
    "type":      "<sfdc|gmail|slack|doc>",
    "source_id": "<Glean 고유 ID 또는 URL 해시>"
  }
"""
import json
import sys
import os
import requests
from pathlib import Path

# 계정 목록 로드
DATA_DIR = Path(__file__).parent.parent / "data"
report   = json.loads((DATA_DIR / "weekly_report.json").read_text(encoding="utf-8"))
accounts = [a["key_account"] for a in report.get("accounts", [])]

API_BASE = os.environ.get("API_BASE", "http://localhost:8000")


def ingest(entries: list[dict]) -> dict:
    """
    Glean 검색 결과를 백엔드 /api/intel/glean-ingest에 POST.

    Args:
        entries: Glean 결과 목록 (account, title, summary, url, date, type, source_id)

    Returns:
        {"ok": bool, "added": int, "skipped": int}
    """
    r = requests.post(
        f"{API_BASE}/api/intel/glean-ingest",
        json={"entries": entries},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def get_sync_status() -> dict:
    """현재 Glean 동기화 상태 조회."""
    r = requests.get(f"{API_BASE}/api/intel/glean-sync-status", timeout=10)
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    print(f"동기화 대상 계정 {len(accounts)}개:")
    for a in accounts:
        print(f"  - {a}")

    print("\n이 스크립트는 Claude Code가 Glean MCP 검색 후 결과를 ingest()로 보냅니다.")
    print("직접 실행: Claude에게 '글린 동기화 해줘'라고 요청하세요.")
    print()

    # 현재 상태 조회
    try:
        status = get_sync_status()
        print(f"현재 동기화 상태:")
        print(f"  마지막 실행: {status.get('last_run') or '없음'}")
        print(f"  총 추가된 항목: {status.get('total_added', 0)}건")
        print(f"  처리된 source_id 수: {status.get('processed_count', 0)}개")
    except Exception as e:
        print(f"상태 조회 실패 (백엔드가 실행 중인지 확인): {e}")
        sys.exit(1)
