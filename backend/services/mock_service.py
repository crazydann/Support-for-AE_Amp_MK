"""
모의 데이터 서비스 - API 키 없이 UI 확인용
"""
from ..models.company import (
    CompanyBlueprint, Executive, Subsidiary,
    BusinessService, AppInfo, NewsItem
)


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
        executives=[
            Executive(name="정신아", title="대표이사"),
            Executive(name="배재현", title="최고투자책임자(CIO)"),
            Executive(name="홍은택", title="이사회 의장"),
            Executive(name="이충호", title="최고재무책임자(CFO)"),
            Executive(name="안세진", title="최고기술책임자(CTO)"),
            Executive(name="김성수", title="사외이사"),
            Executive(name="이진수", title="사내이사"),
        ],
        subsidiaries=[
            Subsidiary(name="카카오페이", relation="자회사", business_type="핀테크/간편결제"),
            Subsidiary(name="카카오뱅크", relation="관계사", business_type="인터넷전문은행"),
            Subsidiary(name="카카오엔터테인먼트", relation="자회사", business_type="콘텐츠/엔터"),
            Subsidiary(name="카카오모빌리티", relation="자회사", business_type="모빌리티"),
            Subsidiary(name="카카오게임즈", relation="자회사", business_type="게임"),
            Subsidiary(name="카카오헬스케어", relation="자회사", business_type="헬스케어"),
            Subsidiary(name="카카오스타일", relation="자회사", business_type="패션커머스"),
            Subsidiary(name="카카오엔터프라이즈", relation="자회사", business_type="B2B 클라우드/AI"),
            Subsidiary(name="카카오브레인", relation="자회사", business_type="AI 연구"),
            Subsidiary(name="카카오인베스트먼트", relation="자회사", business_type="투자"),
            Subsidiary(name="카카오픽코마", relation="자회사", business_type="일본 웹툰"),
            Subsidiary(name="카카오페이지", relation="자회사", business_type="웹툰/웹소설"),
        ],
        web_services=[
            BusinessService(name="카카오톡", url="https://www.kakaotalk.com", type="web", description="모바일 메신저"),
            BusinessService(name="다음(Daum)", url="https://www.daum.net", type="web", description="포털/검색"),
            BusinessService(name="카카오쇼핑", url="https://shopping.kakao.com", type="web", description="커머스"),
            BusinessService(name="카카오맵", url="https://map.kakao.com", type="web", description="지도/내비"),
            BusinessService(name="카카오스토리", url="https://story.kakao.com", type="web", description="SNS"),
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
            NewsItem(title="카카오페이, 1분기 흑자전환 성공…결제 GMV 20% 성장", date="2025.03.18", source="한국경제", summary="카카오페이가 올해 1분기 흑자전환에 성공하며 실적 개선세를 이어가고 있다."),
            NewsItem(title="카카오모빌리티, 자율주행 택시 서울 시범 운영 시작", date="2025.03.15", source="조선비즈", summary="카카오모빌리티가 서울 강남 일대에서 자율주행 택시 시범 서비스를 시작했다."),
            NewsItem(title="카카오엔터, 웹툰 IP 기반 드라마 제작 확대…글로벌 공략", date="2025.03.12", source="스포츠조선"),
            NewsItem(title="카카오, 데이터센터 AI 전용 인프라 투자 3000억 규모", date="2025.03.10", source="전자신문"),
        ],
        ai_analysis="""카카오는 국내 최대 모바일 플랫폼 기업으로, 카카오톡 4,800만 MAU를 핵심 자산으로 다양한 버티컬 서비스를 운영하고 있습니다.

**비즈니스 구조**: 광고·커머스(매출 60%) + 콘텐츠(25%) + 신사업(15%)으로 구성되며, 전형적인 플랫폼 비즈니스 모델입니다.

**디지털 성숙도**: 높음 (Level 4/5). 자체 데이터팀 보유, AI 서비스 카나나 출시, 데이터 기반 개인화 광고 운영 중.

**현재 분석 도구 추정**: 내부 자체 개발 도구 + Google Analytics + 일부 서드파티 가능성 있음.""",
        amplitude_opportunity="""**핵심 기회 포인트**

1. **카카오쇼핑/커머스** - 구매 퍼널 최적화, A/B 테스트 니즈 높음. GMV 성장 압박으로 전환율 개선 시급
2. **카카오페이/뱅크** - 금융 앱 온보딩 퍼널, 기능 활성화율 분석 필요
3. **신규 AI 서비스(카나나)** - 신규 앱 출시 → 사용자 행동 분석 Amplitude 최적 타이밍
4. **카카오게임즈** - 게임 리텐션 분석, 인앱 구매 전환 최적화

**예상 페인 포인트**
- 계열사 간 데이터 사일로 문제
- 자체 개발 도구의 유지보수 비용
- 빠른 실험 사이클 부재""",
        recommended_strategy="""**추천 접근 전략**

1. **진입점**: 카카오엔터프라이즈(B2B) 또는 카카오쇼핑 팀 → 데이터 분석 담당 임원
2. **첫 미팅 어젠다**: 카나나 AI 서비스 런칭 이후 사용자 행동 분석 사례 공유
3. **차별화 포인트**: Amplitude의 그룹 분석 기능으로 계열사 간 사용자 여정 통합 분석 가능성 제시
4. **레퍼런스**: 국내 유사 플랫폼 기업(네이버, 쿠팡) 성공 사례 준비

**다음 액션**
- [ ] 카카오 데이터 분석 관련 채용공고 확인 (pain point 파악)
- [ ] 카나나 앱 직접 사용해보고 분석 인사이트 준비
- [ ] 정신아 대표 최근 인터뷰/컨퍼런스 발언 확인""",
        last_updated="2025-03-26T10:00:00",
        data_sources=["DART(금감원 전자공시)", "네이버뉴스", "공식 홈페이지", "구글플레이스토어"]
    )
}


def get_mock_blueprint(company_name: str) -> CompanyBlueprint:
    """모의 데이터 반환 (정확히 일치 or 첫 번째)"""
    if company_name in MOCK_DATA:
        return MOCK_DATA[company_name]
    # 기본 모의 데이터
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
        executives=[
            Executive(name="홍길동", title="대표이사"),
            Executive(name="김철수", title="최고기술책임자(CTO)"),
            Executive(name="이영희", title="최고재무책임자(CFO)"),
            Executive(name="박지수", title="최고마케팅책임자(CMO)"),
        ],
        subsidiaries=[
            Subsidiary(name=f"{company_name}페이", relation="자회사", business_type="핀테크"),
            Subsidiary(name=f"{company_name}커머스", relation="자회사", business_type="이커머스"),
        ],
        web_services=[
            BusinessService(name="메인 서비스", url="https://example.com", type="web"),
            BusinessService(name="쇼핑몰", url="https://shop.example.com", type="web"),
        ],
        apps=[
            AppInfo(name=f"{company_name} 앱", platform="Android", rating=4.1, downloads="100만+"),
        ],
        recent_news=[
            NewsItem(title=f"{company_name}, 신규 서비스 출시 발표", date="2025.03.20", source="전자신문"),
            NewsItem(title=f"{company_name} 작년 매출 전년 대비 15% 성장", date="2025.03.15", source="매일경제"),
        ],
        ai_analysis=f"{company_name}은 디지털 전환을 적극 추진 중인 기업으로 Amplitude 도입 가능성이 높습니다. (모의 데이터)",
        amplitude_opportunity="이커머스 퍼널 분석, 앱 온보딩 최적화, A/B 테스트 니즈가 예상됩니다. (모의 데이터)",
        recommended_strategy="데이터 분석 담당 임원을 통한 접근을 추천합니다. (모의 데이터)",
        last_updated="2025-03-26T10:00:00",
        data_sources=["모의 데이터"]
    )


def get_mock_search_results(query: str) -> list[dict]:
    companies = [
        {"corp_code": "032640", "corp_name": "카카오", "stock_code": "035720"},
        {"corp_code": "005930", "corp_name": "삼성전자", "stock_code": "005930"},
        {"corp_code": "035420", "corp_name": "NAVER", "stock_code": "035420"},
        {"corp_code": "051910", "corp_name": "LG화학", "stock_code": "051910"},
        {"corp_code": "005380", "corp_name": "현대자동차", "stock_code": "005380"},
        {"corp_code": "017670", "corp_name": "SK텔레콤", "stock_code": "017670"},
        {"corp_code": "030200", "corp_name": "KT", "stock_code": "030200"},
        {"corp_code": "035720", "corp_name": "카카오뱅크", "stock_code": "323410"},
        {"corp_code": "377300", "corp_name": "카카오페이", "stock_code": "377300"},
        {"corp_code": "293490", "corp_name": "카카오게임즈", "stock_code": "293490"},
        {"corp_code": "259960", "corp_name": "크래프톤", "stock_code": "259960"},
        {"corp_code": "251270", "corp_name": "넷마블", "stock_code": "251270"},
        {"corp_code": "036570", "corp_name": "엔씨소프트", "stock_code": "036570"},
        {"corp_code": "112040", "corp_name": "위메이드", "stock_code": "112040"},
        {"corp_code": "000660", "corp_name": "SK하이닉스", "stock_code": "000660"},
    ]
    return [c for c in companies if query.lower() in c["corp_name"].lower()]
