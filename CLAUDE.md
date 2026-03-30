# AE Intelligence Dashboard — Claude Context

## 담당 AE
**MyoungKyu Ho (MK)** — Amplitude Korea, Major Enterprise AE
- 관리 계정: 한국 주요 엔터프라이즈 고객 (~24개 계정)
- Slack: @myoungkyu.ho | SFDC Territory: APJ ENT - KOR - Major - 1

---

## 핵심 영업 전략 (Persistent Playbook)

### 1. 그룹사 MTU 전략 (Group MTU Strategy)
- 그룹 계약 시 **그룹 전체 MTU 계약**을 기본 구조로 제안
- MTU 계약 체결 시 각 계열사 서비스를 **하위 프로젝트(Sub-project)**로 구성 → 개별 분석 + 통합 분석 동시 가능
- 그룹 내 한 계열사 성공 사례를 레버리지하여 다른 계열사로 Expand 추진
- 예시: Shinsegae 그룹(Starbucks → Shinsegae Live Shopping → SSG.com), Lotte 그룹(Lotte Shopping → 하이마트 → Lotte Members)

### 2. 계약 타입 전환 전략 (Contract Upsell Path)
- **Event 단위 계약 고객 → MTU 전환** 우선 추진
- **MTU 전환 완료 고객 → Experiment 또는 Activation Add-on** 크로스셀
- 단계: `Event` → `MTU` → `Experiment Add-on` / `Activation Add-on`

### 3. 2026 Experiment Add-on 집중
- 2026년 전략적 우선순위: **Experiment Add-on** 전 고객 대상 크로스셀
- 특히 MTU 전환 완료된 Enterprise 고객 집중 공략
- 타깃: Musinsa(Enterprise), Dunamu(Enterprise), GS Retail(Enterprise), TVING, CJ Olive Young 등

### 4. Land & Expand 기본 모션
- 신규 고객: 핵심 서비스 1개로 Land → 그룹 내/서비스 내 Expand
- Prospect 전환 시 그룹사 레퍼런스 + PoC 성과 중심 접근

---

## 계정 운영 원칙

### 데이터 업데이트 시 반드시 확인
- `arr` 값은 SFDC Closed Won Opportunity의 ARR 기준
- `subscription_end`는 현재 유효한 계약의 만료일 (SFDC Contract End Date)
- `amplitude_plan`: Growth / Enterprise / Plus
- `status`: active / prospect / churned
- `health`: red(긴급) / orange(주의) / yellow(모니터링) / green(정상) / gray(prospect)

### 계정명 표기 규칙
- 영문 공식명 우선: Musinsa (무신사 X), Dunamu (두나무 X)
- 그룹명도 영문: Musinsa, Dunamu (한글 그룹명 사용 X)
- 한국어 병기가 필요한 경우에만 notes_summary에 기재

### action_items / risks 참조 원칙
- `account` 필드는 반드시 `accounts[].key_account` 값과 정확히 일치해야 함
- 불일치 시 SubAccountRow의 relatedActions/relatedRisks 필터가 작동하지 않음

---

## 영구 메모리 레이어 (Intelligence Memory)

### 사용 방법
- "메모리 업데이트 해줘" → `POST /api/intel/memory/synthesize` 호출 (Intel Log → Account Memory 자동 합성)
- "합성 실행해줘" / "전략 업데이트 해줘" → `POST /api/intel/synthesize` (전체 계정 합성 엔진 실행 → action_items + risks + account_memory 업데이트)
- "XXX 계정 분석해줘" → `POST /api/intel/synthesize/XXX` (특정 계정만 합성)
- "XXX 계정 히스토리 보여줘" → `GET /api/intel/log?account=XXX&days=90`
- "전체 인텔 요약" → `GET /api/intel/memory`
- 인사이트 직접 저장 → `POST /api/intel/memory` with `{"account": "...", "insight": "..."}`

### 파일 구조
```
backend/data/intel_log.jsonl     # append-only 원시 로그 (메모/Gmail/Slack 모든 이벤트)
backend/data/account_memory.json # 계정별 합성 요약 (Claude가 주기적으로 업데이트)
```

### Google Sheets 미러 (같은 Spreadsheet)
- "Intel Log" 탭: intel_log.jsonl 실시간 미러 → 브라우저에서 검색/필터 가능
- "Account Memory" 탭: account_memory.json 미러 → 직접 편집 가능

### 자동 기록 흐름
```
메모 저장     → intel_log.jsonl + Sheets "Intel Log"
Gmail 싱크   → intel_log.jsonl + Sheets "Intel Log"
Slack 싱크   → intel_log.jsonl + Sheets "Intel Log"
Claude 분석  → account_memory.json + Sheets "Account Memory"
Glean 동기화 → intel_log.jsonl + Sheets "Intel Log"
```

### Glean 동기화 방법
"글린 동기화 해줘" 명령 시:
1. weekly_report.json에서 계정 목록 로드
2. 각 계정별로 Glean MCP 검색 (salescloud, gmail, slack)
3. 결과를 POST /api/intel/glean-ingest로 전송
4. intel_log.jsonl + Google Sheets "Intel Log" 탭에 자동 저장

검색 앱: salescloud (SFDC), gmail, slack
검색 쿼리 패턴: "{account_name} Amplitude"

---

## 프로젝트 구조

```
backend/
  data/
    weekly_report.json    # 주간 보고 스냅샷 (계정, 액션, 리스크, 전략)
    intel_log.jsonl       # append-only 이벤트 로그 (영구 누적)
    account_memory.json   # 계정별 합성 인텔리전스 (Claude 업데이트)
    notes.json            # 메모 fallback (Sheets 미사용 시)
  services/
    intel_memory_service.py  # Intel Log + Account Memory + Sheets 미러
    gmail_sync.py            # Gmail 동기화 (inbox + sent, after:YYYY/MM/DD)
    account_keywords.py      # 계정별 키워드 매핑 (메모 분류용)
    report_sync.py           # Gmail/Slack → activity_history + Intel Log
  routers/
    intel.py              # /api/intel/* (메모, 리포트, log, memory)
frontend/
  src/
    App.jsx               # 헤더 토글: Todo | Account | Weekly
    pages/DashboardPage.jsx  # TodoView / AccountView / WeeklyView
    pages/MemoPage.jsx    # 음성/텍스트 메모 + 구글시트 저장
    i18n.js               # KO/EN 번역
render.yaml               # Render.com 배포 설정
CLAUDE.md                 # 이 파일 (Claude 세션 context)
```

---

## 배포

- **플랫폼**: Render.com (단일 서비스 `ae-intelligence`)
- **빌드**: `cd frontend && npm install && npm run build && pip install -r backend/requirements.txt`
- **주의**: React UI 변경은 Render에서 `npm run build` 재실행 필요 → 자동 배포 또는 Manual Deploy
- **데이터(JSON) 변경**: 즉시 반영 (빌드 불필요)
- **브랜치**: 항상 `main`에 push (Render가 main 추적)
