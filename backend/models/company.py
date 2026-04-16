from pydantic import BaseModel
from typing import Optional


class Executive(BaseModel):
    name: str
    title: str
    profile_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None


class ServiceInfo(BaseModel):
    name: str
    type: str  # web, app_ios, app_android
    url: Optional[str] = None
    mau: Optional[str] = None  # "1,200만", "500K" 등


class OrgNode(BaseModel):
    """조직도 노드 - 계열사/자회사 하나"""
    name: str
    relation: Optional[str] = None        # 자회사, 관계사, 계열사
    website: Optional[str] = None
    industry: Optional[str] = None

    # 서비스 현황
    services: list[ServiceInfo] = []
    mau: Optional[str] = None              # 대표 MAU (통합)

    # Amplitude 현황
    amplitude_status: str = "unknown"      # active | not_used | unknown
    amplitude_plan: Optional[str] = None   # Enterprise, Growth, Starter
    amplitude_note: Optional[str] = None   # 사용 현황 메모
    arr: Optional[str] = None              # Annual Recurring Revenue (USD)
    subscription_end: Optional[str] = None # 계약 만료일 YYYY-MM-DD

    # 하위 조직 (재귀)
    children: list['OrgNode'] = []

OrgNode.model_rebuild()

# dart_service.py 호환용 별칭 (Subsidiary = OrgNode)
Subsidiary = OrgNode


class AppInfo(BaseModel):
    name: str
    platform: str  # iOS, Android
    store_url: Optional[str] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    downloads: Optional[str] = None


class BusinessService(BaseModel):
    name: str
    url: Optional[str] = None
    description: Optional[str] = None
    type: str  # web, app, offline


class NewsItem(BaseModel):
    title: str
    url: Optional[str] = None
    date: Optional[str] = None
    summary: Optional[str] = None
    source: Optional[str] = None


class CompanyBlueprint(BaseModel):
    # 기본 정보
    company_name: str
    corp_code: Optional[str] = None
    stock_code: Optional[str] = None
    ceo: Optional[str] = None
    founded: Optional[str] = None
    employees: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None

    # 비즈니스 형태
    business_type: Optional[str] = None
    online_offline_ratio: Optional[str] = None

    # 임원진
    executives: list[Executive] = []

    # 조직도 (그룹사용)
    org_chart: list[OrgNode] = []

    # 서비스
    web_services: list[BusinessService] = []
    apps: list[AppInfo] = []

    # 최신 뉴스
    recent_news: list[NewsItem] = []

    # Amplitude 현황 (본사)
    amplitude_status: str = "unknown"       # active | not_used | unknown
    amplitude_plan: Optional[str] = None
    amplitude_note: Optional[str] = None
    arr: Optional[str] = None              # Annual Recurring Revenue (USD)
    subscription_end: Optional[str] = None # 계약 만료일 YYYY-MM-DD

    # AI 분석
    ai_analysis: Optional[str] = None
    amplitude_opportunity: Optional[str] = None
    recommended_strategy: Optional[str] = None

    # 메타
    last_updated: Optional[str] = None
    data_sources: list[str] = []
