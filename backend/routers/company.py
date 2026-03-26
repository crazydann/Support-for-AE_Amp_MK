from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..models.company import CompanyBlueprint
from ..services.blueprint_service import BlueprintService
from ..dependencies import get_blueprint_service

router = APIRouter(prefix="/api/company", tags=["company"])


class RefineStrategyRequest(BaseModel):
    notes: str


class EmailDraftRequest(BaseModel):
    purpose: str
    recipient_name: str
    recipient_title: str


@router.get("/search")
async def search_company(
    q: str,
    service: BlueprintService = Depends(get_blueprint_service),
):
    """DART 기업 검색 (자동완성용)"""
    if len(q) < 2:
        return []
    results = await service.get_dart_search_results(q)
    return results[:10]


@router.get("/blueprint/{company_name}", response_model=CompanyBlueprint)
async def get_blueprint(
    company_name: str,
    service: BlueprintService = Depends(get_blueprint_service),
):
    """기업 청사진 생성 (메인 엔드포인트)"""
    try:
        blueprint = await service.build_blueprint(company_name)
        return blueprint
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/blueprint/{company_name}/refine-strategy")
async def refine_strategy(
    company_name: str,
    body: RefineStrategyRequest,
    service: BlueprintService = Depends(get_blueprint_service),
):
    """AE 메모 기반 전략 보완"""
    try:
        # 간단한 청사진 재생성 (캐시 없으므로 이름만 전달)
        from ..models.company import CompanyBlueprint as BP
        dummy = BP(company_name=company_name, ai_analysis=body.notes)
        result = await service.ai.refine_strategy(dummy, body.notes)
        return {"refined_strategy": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/blueprint/{company_name}/email-draft")
async def generate_email_draft(
    company_name: str,
    body: EmailDraftRequest,
    service: BlueprintService = Depends(get_blueprint_service),
):
    """영업 이메일 초안 생성"""
    try:
        from ..models.company import CompanyBlueprint as BP
        blueprint = BP(company_name=company_name)
        draft = await service.ai.generate_email_draft(
            blueprint,
            purpose=body.purpose,
            recipient_name=body.recipient_name,
            recipient_title=body.recipient_title,
        )
        return {"draft": draft}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
