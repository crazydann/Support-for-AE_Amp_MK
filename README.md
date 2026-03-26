# AE Intelligence - Amplitude AE 고객 인텔리전스 플랫폼

Amplitude AE를 위한 고객사 청사진 자동 생성 웹 대시보드.
기업명 하나로 임원진, 계열사, 비즈니스 모델, 최신 뉴스, AI 세일즈 전략까지 즉시 생성합니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **기업 청사진** | 임원진, 계열사, 서비스, 온/오프라인 비즈니스 형태 자동 수집 |
| **그룹사 계열사** | DART 공시 기반 계열사/자회사 전체 목록 |
| **온라인 인텔리전스** | 공식 웹사이트, 앱 서비스, 최신 뉴스 실시간 분석 |
| **AI 전략 제안** | Claude AI 기반 Amplitude 기회 분석 및 세일즈 접근 전략 |
| **이메일 초안** | 임원 대상 개인화된 영업 이메일 초안 자동 생성 |
| **전략 보완** | AE의 메모/현황을 바탕으로 다음 액션 아이템 AI 제안 |

## 데이터 출처

- **DART(금감원 전자공시)** - 임원현황, 계열사, 기업 기본 정보
- **네이버 뉴스** - 최신 뉴스 (SerpAPI 설정 시 Google 검색)
- **공식 홈페이지** - 서비스 메뉴, 비즈니스 소개
- **구글 플레이스토어** - 앱 서비스 정보
- **Claude AI (claude-sonnet-4-6)** - 종합 분석 및 전략 생성

## 빠른 시작

### 1. API 키 준비

| 키 | 발급처 | 비용 |
|----|--------|------|
| DART API | https://opendart.fss.or.kr | 무료 |
| Anthropic API | https://console.anthropic.com | 유료 |
| SerpAPI (선택) | https://serpapi.com | 무료 플랜 있음 |

### 2. 백엔드 실행

```bash
cd backend
cp .env.example .env
# .env 파일에 API 키 입력

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 프로젝트 구조

```
├── backend/
│   ├── main.py              # FastAPI 앱 진입점
│   ├── config.py            # 환경 변수 설정
│   ├── dependencies.py      # DI 설정
│   ├── models/
│   │   └── company.py       # 데이터 모델
│   ├── services/
│   │   ├── dart_service.py  # DART API 연동
│   │   ├── search_service.py # 웹 검색/스크래핑
│   │   ├── ai_service.py    # Claude AI 분석
│   │   └── blueprint_service.py # 청사진 통합 생성
│   └── routers/
│       └── company.py       # API 엔드포인트
└── frontend/
    └── src/
        ├── pages/
        │   ├── SearchPage.jsx
        │   └── BlueprintPage.jsx
        └── components/
            ├── CompanyHeader.jsx
            ├── ExecutivesPanel.jsx
            ├── SubsidiariesPanel.jsx
            ├── ServicesPanel.jsx
            ├── NewsPanel.jsx
            └── AIStrategyPanel.jsx
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/company/search?q={이름}` | 기업 검색 (자동완성) |
| GET | `/api/company/blueprint/{기업명}` | 기업 청사진 생성 |
| POST | `/api/company/blueprint/{기업명}/refine-strategy` | 전략 보완 |
| POST | `/api/company/blueprint/{기업명}/email-draft` | 이메일 초안 생성 |

## 향후 로드맵

- [ ] 캐싱 (Redis) - 동일 기업 재조회 속도 향상
- [ ] 계정 관리 - 여러 고객사 저장 및 비교
- [ ] 실행 기능 - Gmail 발송, Google Calendar 일정 등록
- [ ] LinkedIn 연동 - 임원 프로필 강화
- [ ] 알림 - 고객사 주요 뉴스 실시간 알림
