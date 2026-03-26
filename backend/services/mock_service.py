"""
모의 데이터 서비스 - API 키 없이 UI 확인용
"""
from ..models.company import (
    CompanyBlueprint, Executive, OrgNode, ServiceInfo,
    BusinessService, AppInfo, NewsItem
)

# ── 카카오 그룹 조직도 ──────────────────────────────────────────
KAKAO_ORG = [
    OrgNode(
        name="카카오",
        relation="지주/본사",
        website="https://www.kakao.com",
        industry="플랫폼",
        mau="4,800만",
        amplitude_status="active",
        amplitude_plan="Enterprise",
        amplitude_note="카카오톡·다음 통합 분석, 2019년 도입",
        services=[
            ServiceInfo(name="카카오톡", type="app_android", mau="4,800만"),
            ServiceInfo(name="다음(Daum)", type="web", mau="2,100만"),
            ServiceInfo(name="카카오맵", type="app_android", mau="1,300만"),
        ],
        children=[
            OrgNode(
                name="카카오페이",
                relation="자회사",
                website="https://pay.kakao.com",
                industry="핀테크",
                mau="2,400만",
                amplitude_status="active",
                amplitude_plan="Enterprise",
                amplitude_note="결제 퍼널 분석, A/B 테스트 활발히 사용 중",
                services=[
                    ServiceInfo(name="카카오페이 앱", type="app_android", mau="2,400만"),
                    ServiceInfo(name="카카오페이 웹", type="web"),
                ],
            ),
            OrgNode(
                name="카카오뱅크",
                relation="관계사",
                website="https://www.kakaobank.com",
                industry="인터넷은행",
                mau="1,800만",
                amplitude_status="not_used",
                amplitude_note="자체 데이터 플랫폼 운영 (금융 규제 이슈)",
                services=[
                    ServiceInfo(name="카카오뱅크 앱", type="app_android", mau="1,800만"),
                ],
            ),
            OrgNode(
                name="카카오엔터테인먼트",
                relation="자회사",
                website="https://www.kakaoent.com",
                industry="콘텐츠/엔터",
                mau="3,200만",
                amplitude_status="active",
                amplitude_plan="Growth",
                amplitude_note="웹툰·음원 리텐션 분석에 활용",
                services=[
                    ServiceInfo(name="카카오웹툰", type="app_android", mau="1,100만"),
                    ServiceInfo(name="멜론", type="app_android", mau="2,100만"),
                    ServiceInfo(name="카카오페이지", type="app_android", mau="900만"),
                ],
                children=[
                    OrgNode(
                        name="카카오픽코마",
                        relation="자회사",
                        website="https://piccoma.com",
                        industry="일본 웹툰",
                        mau="650만 (일본)",
                        amplitude_status="unknown",
                        amplitude_note="일본 법인, 별도 트래킹 도구 사용 추정",
                        services=[
                            ServiceInfo(name="Piccoma 앱", type="app_android", mau="650만"),
                        ],
                    ),
                ],
            ),
            OrgNode(
                name="카카오모빌리티",
                relation="자회사",
                website="https://www.kakaomobility.com",
                industry="모빌리티",
                mau="3,600만",
                amplitude_status="active",
                amplitude_plan="Enterprise",
                amplitude_note="카카오T 앱 사용자 여정 분석, 드라이버/라이더 양면 분석",
                services=[
                    ServiceInfo(name="카카오T", type="app_android", mau="3,600만"),
                    ServiceInfo(name="카카오내비", type="app_android", mau="1,400만"),
                ],
            ),
            OrgNode(
                name="카카오게임즈",
                relation="자회사",
                website="https://www.kakaogames.com",
                industry="게임",
                mau="820만",
                amplitude_status="not_used",
                amplitude_note="GameAnalytics 사용 중, Amplitude 미도입",
                services=[
                    ServiceInfo(name="오딘: 발할라 라이징", type="app_android", mau="340만"),
                    ServiceInfo(name="카카오게임즈 포털", type="web"),
                ],
            ),
            OrgNode(
                name="카카오엔터프라이즈",
                relation="자회사",
                website="https://kakaoenterprise.com",
                industry="B2B SaaS/AI",
                amplitude_status="unknown",
                amplitude_note="B2B 서비스, 내부 분석 도구 보유",
                services=[
                    ServiceInfo(name="카카오 i 클라우드", type="web"),
                    ServiceInfo(name="카카오워크", type="app_android"),
                ],
            ),
            OrgNode(
                name="카카오헬스케어",
                relation="자회사",
                website="https://kakaohealth.com",
                industry="헬스케어",
                mau="210만",
                amplitude_status="unknown",
                amplitude_note="2023년 설립 초기, 분석 도구 미확인",
                services=[
                    ServiceInfo(name="파스타(PASTA)", type="app_android", mau="210만"),
                ],
            ),
        ],
    )
]

MOCK_DATA = {
    "카카오": CompanyBlueprint(
        company_name="카카오",
        corp_code="032640",
        stock_code="035720",
        ceo="정신아",
        founded="19990203",
        employees="3,247",
        industry="정보통신업",
        address="경기도 성남시 분당구 판교역로 235",
        website="https://www.kakao.com",
        description="카카오는 모바일 메신저 카카오톡을 기반으로 다양한 디지털 서비스를 제공하는 플랫폼 기업입니다. 검색, 쇼핑, 금융, 콘텐츠, 모빌리티 등 일상의 모든 영역에서 서비스를 운영하고 있습니다.",
        business_type="B2C",
        online_offline_ratio="온라인 중심 (90% 이상)",
        amplitude_status="active",
        amplitude_plan="Enterprise",
        amplitude_note="2019년 도입, 카카오톡·다음 통합 분석 환경 구축. 현재 데이터 분석팀 50명+ 사용 중",
        executives=[
            Executive(name="정신아", title="대표이사"),
            Executive(name="배재현", title="최고투자책임자(CIO)"),
            Executive(name="홍은택", title="이사회 의장"),
            Executive(name="이충호", title="최고재무책임자(CFO)"),
            Executive(name="안세진", title="최고기술책임자(CTO)"),
            Executive(name="김성수", title="사외이사"),
            Executive(name="이진수", title="사내이사"),
        ],
        org_chart=KAKAO_ORG,
        web_services=[
            BusinessService(name="카카오톡", url="https://www.kakaotalk.com", type="web", description="모바일 메신저"),
            BusinessService(name="다음(Daum)", url="https://www.daum.net", type="web", description="포털/검색"),
            BusinessService(name="카카오쇼핑", url="https://shopping.kakao.com", type="web", description="커머스"),
            BusinessService(name="카카오맵", url="https://map.kakao.com", type="web", description="지도/내비"),
            BusinessService(name="카카오TV", url="https://tv.kakao.com", type="web", description="동영상 플랫폼"),
        ],
        apps=[
            AppInfo(name="카카오톡", platform="Android", rating=4.2, downloads="5억+", category="커뮤니케이션"),
            AppInfo(name="카카오맵", platform="Android", rating=4.3, downloads="1억+", category="내비게이션"),
            AppInfo(name="카카오페이", platform="Android", rating=4.1, downloads="5천만+", category="금융"),
            AppInfo(name="카카오T", platform="Android", rating=4.0, downloads="1천만+", category="교통/모빌리티"),
        ],
        recent_news=[
            NewsItem(title="카카오, AI 서비스 '카나나' 정식 출시…카카오톡 연동 강화", date="2025.03.20", source="매일경제", summary="카카오가 자체 개발한 AI 서비스 카나나를 정식 출시하며 카카오톡과의 연동을 대폭 강화했다고 밝혔다."),
            NewsItem(title="카카오페이, 1분기 흑자전환 성공…결제 GMV 20% 성장", date="2025.03.18", source="한국경제"),
            NewsItem(title="카카오모빌리티, 자율주행 택시 서울 시범 운영 시작", date="2025.03.15", source="조선비즈"),
            NewsItem(title="카카오엔터, 웹툰 IP 기반 드라마 제작 확대…글로벌 공략", date="2025.03.12", source="스포츠조선"),
            NewsItem(title="카카오, 데이터센터 AI 전용 인프라 투자 3000억 규모", date="2025.03.10", source="전자신문"),
        ],
        ai_analysis="""카카오는 국내 최대 모바일 플랫폼 기업으로, 카카오톡 4,800만 MAU를 핵심 자산으로 다양한 버티컬 서비스를 운영합니다.

**비즈니스 구조**: 광고·커머스(매출 60%) + 콘텐츠(25%) + 신사업(15%)으로 구성된 플랫폼 비즈니스.

**Amplitude 도입 현황**: 본사 및 카카오페이, 카카오엔터, 카카오모빌리티 등 주요 계열사에 도입 완료. 카카오뱅크·카카오게임즈는 미도입 상태로 확장 기회 존재.""",
        amplitude_opportunity="""**기존 고객 확장 전략**

현재 Enterprise 계약 중이나 미도입 계열사 3개사 대상 확장 기회:
- **카카오뱅크** (MAU 1,800만): 금융 규제 이슈 해소 시 최우선 타겟
- **카카오게임즈** (MAU 820만): GameAnalytics 대체 가능성, 게임 리텐션 분석 강점 어필
- **카카오헬스케어** (MAU 210만): 초기 스타트업 단계, 빠른 실험 문화 정착에 Amplitude 최적""",
        recommended_strategy="""**즉시 실행 액션**
1. 카카오 본사 담당자 통해 카카오게임즈 PM팀 인트로 요청
2. 카카오뱅크 — 금융권 Amplitude 도입 사례(해외 핀테크) 자료 준비
3. 카카오헬스케어 — 헬스케어 앱 온보딩 개선 케이스 스터디 공유""",
        last_updated="2025-03-26T10:00:00",
        data_sources=["DART(금감원 전자공시)", "네이버뉴스", "공식 홈페이지", "구글플레이스토어", "채용공고 분석"]
    )
}


def get_mock_blueprint(company_name: str) -> CompanyBlueprint:
    if company_name in MOCK_DATA:
        return MOCK_DATA[company_name]
    return CompanyBlueprint(
        company_name=company_name,
        ceo="홍길동",
        founded="20000101",
        employees="1,200",
        industry="정보통신업",
        website="https://example.com",
        description=f"{company_name}은 다양한 디지털 서비스를 제공하는 기업입니다. (모의 데이터)",
        business_type="B2C",
        online_offline_ratio="온/오프라인 혼합",
        amplitude_status="unknown",
        amplitude_note="Amplitude 도입 여부 확인 필요",
        executives=[
            Executive(name="홍길동", title="대표이사"),
            Executive(name="김철수", title="최고기술책임자(CTO)"),
            Executive(name="이영희", title="최고재무책임자(CFO)"),
        ],
        org_chart=[
            OrgNode(
                name=company_name,
                relation="본사",
                mau="미확인",
                amplitude_status="unknown",
                services=[ServiceInfo(name="메인 서비스", type="web")],
                children=[
                    OrgNode(
                        name=f"{company_name}페이",
                        relation="자회사",
                        amplitude_status="unknown",
                        services=[ServiceInfo(name=f"{company_name}페이 앱", type="app_android")],
                    ),
                ],
            )
        ],
        recent_news=[
            NewsItem(title=f"{company_name}, 신규 서비스 출시 발표", date="2025.03.20", source="전자신문"),
        ],
        ai_analysis=f"{company_name} 분석 중... (모의 데이터)",
        amplitude_opportunity="확인 필요 (모의 데이터)",
        recommended_strategy="데이터 분석 담당 임원 접근 추천 (모의 데이터)",
        last_updated="2025-03-26T10:00:00",
        data_sources=["모의 데이터"]
    )


def get_mock_search_results(query: str) -> list[dict]:
    companies = [
        {"corp_code": "032640", "corp_name": "카카오", "stock_code": "035720"},
        {"corp_code": "005930", "corp_name": "삼성전자", "stock_code": "005930"},
        {"corp_code": "035420", "corp_name": "NAVER", "stock_code": "035420"},
        {"corp_code": "005380", "corp_name": "현대자동차", "stock_code": "005380"},
        {"corp_code": "017670", "corp_name": "SK텔레콤", "stock_code": "017670"},
        {"corp_code": "030200", "corp_name": "KT", "stock_code": "030200"},
        {"corp_code": "377300", "corp_name": "카카오페이", "stock_code": "377300"},
        {"corp_code": "293490", "corp_name": "카카오게임즈", "stock_code": "293490"},
        {"corp_code": "259960", "corp_name": "크래프톤", "stock_code": "259960"},
        {"corp_code": "000660", "corp_name": "SK하이닉스", "stock_code": "000660"},
        {"corp_code": "051900", "corp_name": "LG생활건강", "stock_code": "051900"},
        {"corp_code": "068270", "corp_name": "셀트리온", "stock_code": "068270"},
        {"corp_code": "028260", "corp_name": "삼성물산", "stock_code": "028260"},
        {"corp_code": "096770", "corp_name": "SK이노베이션", "stock_code": "096770"},
        {"corp_code": "003550", "corp_name": "LG", "stock_code": "003550"},
    ]
    return [c for c in companies if query.lower() in c["corp_name"].lower()]
