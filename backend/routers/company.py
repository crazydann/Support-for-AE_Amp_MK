from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.company import CompanyBlueprint
from ..services.mock_service import get_mock_blueprint, get_mock_search_results

router = APIRouter(prefix="/api/company", tags=["company"])


class RefineStrategyRequest(BaseModel):
    notes: str


class EmailDraftRequest(BaseModel):
    purpose: str
    recipient_name: str
    recipient_title: str


@router.get("/search")
async def search_company(q: str):
    """기업 검색 (자동완성용)"""
    if len(q) < 2:
        return []
    return get_mock_search_results(q)[:10]


@router.get("/blueprint/{company_name}", response_model=CompanyBlueprint)
async def get_blueprint(company_name: str):
    """기업 청사진 생성"""
    try:
        return get_mock_blueprint(company_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/blueprint/{company_name}/refine-strategy")
async def refine_strategy(company_name: str, body: RefineStrategyRequest):
    """전략 보완 (모의 응답)"""
    return {
        "refined_strategy": f"""[모의 데이터] {company_name} 전략 보완 결과

**즉시 실행 가능한 액션 3가지**
1. {company_name} 데이터 분석팀 LinkedIn 서치 → 핵심 담당자 파악
2. 최근 뉴스 기반 개인화된 콜드 이메일 초안 작성
3. Amplitude 유사 고객사(동종업계) 레퍼런스 케이스 준비

**이번 주 안에 할 일**
- 공식 채용공고 확인 → "데이터 분석", "A/B 테스트" 관련 JD 파악
- 제품 직접 사용해보고 사용자 여정 분석 메모

**다음 미팅 준비**
- {body.notes[:50]}... 내용 기반으로 데모 시나리오 커스터마이징
- ROI 계산기 준비 (전환율 1% 개선 시 매출 영향도)"""
    }


@router.post("/blueprint/{company_name}/email-draft")
async def generate_email_draft(company_name: str, body: EmailDraftRequest):
    """이메일 초안 생성 (모의 응답)"""
    return {
        "draft": f"""안녕하세요, {body.recipient_name} {body.recipient_title}.

저는 Amplitude Korea의 Account Executive 입니다.

최근 {company_name}의 디지털 서비스 확장 소식을 접하고 연락드리게 되었습니다. 특히 신규 앱 서비스 론칭과 함께 사용자 행동 분석의 중요성이 더욱 커졌을 것으로 생각됩니다.

Amplitude는 {company_name}와 유사한 플랫폼 기업들이 제품 퍼널 최적화와 사용자 리텐션 개선에 활용하고 있는 제품 분석 플랫폼입니다. 실제로 국내 주요 플랫폼사에서 Amplitude 도입 후 핵심 전환율을 평균 23% 개선한 사례가 있습니다.

30분 정도 시간을 내주신다면, {company_name}의 현재 데이터 분석 환경과 Amplitude가 어떤 가치를 드릴 수 있는지 말씀 나누고 싶습니다.

다음 주 편하신 시간을 알려주시면 감사하겠습니다.

감사합니다.
Amplitude Korea AE 드림"""
    }
