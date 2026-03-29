"""
Google OAuth 초기 설정 스크립트
이 스크립트를 로컬에서 한 번만 실행하여 refresh_token을 발급받으세요.

실행 방법:
  pip install google-auth-oauthlib
  python scripts/google_auth_setup.py

출력된 GOOGLE_REFRESH_TOKEN을 Render 환경변수에 설정하세요.
"""

import json
import os
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]

def main():
    print("=" * 60)
    print("Google OAuth 설정 스크립트")
    print("=" * 60)
    print()
    print("준비물:")
    print("1. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성")
    print("   - 유형: 데스크톱 앱 (Desktop app)")
    print("   - JSON 파일 다운로드")
    print()

    # credentials.json 경로 입력
    creds_path = input("다운로드한 client_secret JSON 파일 경로 입력: ").strip()
    if not creds_path or not os.path.exists(creds_path):
        print(f"파일을 찾을 수 없습니다: {creds_path}")
        return

    print()
    print("브라우저가 열리면 Google 계정(myoungkyu.ho@amplitude.com)으로 로그인하세요.")
    print()

    flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
    creds = flow.run_local_server(port=0)

    print()
    print("=" * 60)
    print("✅ 인증 성공! 아래 값을 Render 환경변수에 설정하세요:")
    print("=" * 60)
    print()

    # client_secret 파일에서 client_id, client_secret 읽기
    with open(creds_path) as f:
        client_data = json.load(f)

    installed = client_data.get("installed") or client_data.get("web") or {}
    client_id = installed.get("client_id", creds.client_id)
    client_secret = installed.get("client_secret", creds.client_secret)

    print(f"GOOGLE_CLIENT_ID={client_id}")
    print(f"GOOGLE_CLIENT_SECRET={client_secret}")
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    print()
    print("Render Dashboard → Environment → Add Environment Variable")
    print("위 3개 값을 모두 추가하세요.")


if __name__ == "__main__":
    main()
