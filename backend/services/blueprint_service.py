"""
기업 청사진 통합 서비스
- DART, 웹 검색, AI 분석을 조합하여 완성된 청사진 생성
"""
from datetime import datetime
from typing import Optional

from ..models.company import CompanyBlueprint, BusinessService
from .dart_service import DartService
from .search_service import SearchService
from .ai_service import AIService


class BlueprintService:
    def __init__(
        self,
        dart_service: DartService,
        search_service: SearchService,
        ai_service: AIService,
    ):
        self.dart = dart_service
        self.search = search_service
        self.ai = ai_service

    async def build_blueprint(self, company_name: str) -> CompanyBlueprint:
        """회사명을 받아 완성된 청사진 생성"""
        blueprint = CompanyBlueprint(company_name=company_name)
        data_sources = []

        # 1. DART에서 기업 기본 정보 조회
        dart_companies = await self.dart.search_company(company_name)
        if dart_companies:
            best_match = _find_best_match(dart_companies, company_name)
            if best_match:
                corp_code = best_match["corp_code"]
                blueprint.corp_code = corp_code
                blueprint.stock_code = best_match.get("stock_code")

                # 기업 상세 정보
                info = await self.dart.get_company_info(corp_code)
                if info:
                    blueprint.ceo = info.get("ceo_nm")
                    blueprint.founded = info.get("est_dt")
                    blueprint.industry = info.get("induty_code")
                    blueprint.address = info.get("adres")
                    blueprint.website = info.get("hm_url")
                    blueprint.employees = info.get("enpEmpeCnt")
                    data_sources.append("DART(금감원 전자공시)")

                # 임원 현황
                executives = await self.dart.get_executives(corp_code)
                if executives:
                    blueprint.executives = executives
                    data_sources.append("DART 임원현황")

                # 계열사/자회사
                subsidiaries = await self.dart.get_subsidiaries(corp_code)
                if subsidiaries:
                    blueprint.subsidiaries = subsidiaries
                    data_sources.append("DART 계열사현황")

        # 2. 웹 검색으로 추가 정보 수집
        search_results = await self.search.search_web(
            f"{company_name} 서비스 앱 비즈니스 소개", num=10
        )

        # 공식 홈페이지 찾기
        official_url = blueprint.website or _find_official_website(search_results, company_name)
        if official_url:
            blueprint.website = official_url
            site_info = await self.search.get_website_info(official_url)
            if site_info:
                if not blueprint.description and site_info.get("description"):
                    blueprint.description = site_info["description"]
                # 서비스 메뉴 추출
                for svc in site_info.get("services", [])[:10]:
                    blueprint.web_services.append(
                        BusinessService(
                            name=svc["text"],
                            url=svc["href"],
                            type="web",
                        )
                    )
                data_sources.append("공식 홈페이지")

        # 3. 최신 뉴스 수집
        news = await self.search.get_recent_news(company_name)
        if news:
            blueprint.recent_news = news
            data_sources.append("네이버뉴스")

        # 4. 앱 정보 수집
        apps = await self.search.search_apps(company_name)
        if apps:
            blueprint.apps = apps
            data_sources.append("구글플레이스토어")

        # 5. 비즈니스 형태 추정
        blueprint.business_type = _estimate_business_type(blueprint)
        blueprint.online_offline_ratio = _estimate_online_offline(blueprint)

        # 6. AI 분석 (마지막 단계)
        ai_result = await self.ai.analyze_company(blueprint)
        blueprint.ai_analysis = ai_result.get("ai_analysis", "")
        blueprint.amplitude_opportunity = ai_result.get("amplitude_opportunity", "")
        blueprint.recommended_strategy = ai_result.get("recommended_strategy", "")

        blueprint.last_updated = datetime.now().isoformat()
        blueprint.data_sources = list(set(data_sources))

        return blueprint

    async def get_dart_search_results(self, company_name: str) -> list[dict]:
        """DART 검색 결과만 반환 (빠른 자동완성용)"""
        return await self.dart.search_company(company_name)


def _find_best_match(companies: list[dict], query: str) -> Optional[dict]:
    """검색 결과에서 가장 일치하는 기업 찾기"""
    # 정확히 일치하는 것 우선
    for c in companies:
        if c["corp_name"] == query:
            return c
    # 포함된 것 중 상장사 우선 (stock_code가 있는 것)
    for c in companies:
        if c.get("stock_code") and query in c["corp_name"]:
            return c
    return companies[0] if companies else None


def _find_official_website(search_results: list[dict], company_name: str) -> Optional[str]:
    """검색 결과에서 공식 홈페이지 URL 추정"""
    company_short = company_name.replace("주식회사", "").replace("(주)", "").strip()
    for result in search_results:
        url = result.get("url", "")
        title = result.get("title", "")
        # 공식 사이트 패턴 감지
        if any(kw in title for kw in ["공식", "official", "홈페이지"]):
            return url
        # 회사명이 도메인에 포함
        if company_short[:3].lower() in url.lower():
            return url
    return None


def _estimate_business_type(blueprint: CompanyBlueprint) -> str:
    """비즈니스 타입 추정 (B2B/B2C/B2B2C)"""
    text = " ".join(
        [
            blueprint.description or "",
            blueprint.industry or "",
            " ".join([s.name for s in blueprint.web_services]),
        ]
    ).lower()

    b2c_keywords = ["쇼핑", "커머스", "배달", "여행", "게임", "소비자", "retail", "앱"]
    b2b_keywords = ["솔루션", "기업", "엔터프라이즈", "b2b", "서비스형", "saas"]

    b2c_score = sum(1 for kw in b2c_keywords if kw in text)
    b2b_score = sum(1 for kw in b2b_keywords if kw in text)

    if b2b_score > b2c_score:
        return "B2B"
    elif b2c_score > b2b_score:
        return "B2C"
    return "B2B2C"


def _estimate_online_offline(blueprint: CompanyBlueprint) -> str:
    """온/오프라인 비중 추정"""
    has_apps = len(blueprint.apps) > 0
    has_web_services = len(blueprint.web_services) > 3
    industry = (blueprint.industry or "").lower()

    offline_keywords = ["제조", "건설", "유통", "물류", "금융", "보험", "병원", "백화점"]
    is_heavy_offline = any(kw in industry for kw in offline_keywords)

    if has_apps and has_web_services and not is_heavy_offline:
        return "온라인 중심 (70% 이상)"
    elif is_heavy_offline and not has_apps:
        return "오프라인 중심 (70% 이상)"
    return "온/오프라인 혼합"
