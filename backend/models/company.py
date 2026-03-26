from pydantic import BaseModel
from typing import Optional


class Executive(BaseModel):
    name: str
    title: str
    profile_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None


class Subsidiary(BaseModel):
    name: str
    business_type: Optional[str] = None
    website: Optional[str] = None
    relation: Optional[str] = None  # 자회사, 관계사, 계열사 등


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
    corp_code: Optional[str] = None  # DART 기업코드
    stock_code: Optional[str] = None
    ceo: Optional[str] = None
    founded: Optional[str] = None
    employees: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None

    # 비즈니스 형태
    business_type: Optional[str] = None  # B2B, B2C, B2B2C
    online_offline_ratio: Optional[str] = None  # 온라인/오프라인 비중

    # 임원진
    executives: list[Executive] = []

    # 계열사/자회사
    subsidiaries: list[Subsidiary] = []

    # 서비스
    web_services: list[BusinessService] = []
    apps: list[AppInfo] = []

    # 최신 뉴스
    recent_news: list[NewsItem] = []

    # AI 분석
    ai_analysis: Optional[str] = None
    amplitude_opportunity: Optional[str] = None  # Amplitude 세일즈 기회 분석
    recommended_strategy: Optional[str] = None

    # 메타
    last_updated: Optional[str] = None
    data_sources: list[str] = []
