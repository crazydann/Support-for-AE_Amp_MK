"""
Claude AI 분석 서비스
- 수집된 데이터를 종합 분석
- Amplitude AE 전략 제안
"""
import anthropic
from ..models.company import CompanyBlueprint


ANALYSIS_SYSTEM_PROMPT = """당신은 Amplitude(제품 분석 플랫폼) 전문 Account Executive(AE)의 어시스턴트입니다.
수집된 기업 정보를 바탕으로 다음을 분석해주세요:

1. **기업 개요 요약**: 비즈니스 모델, 온/오프라인 비중, 핵심 서비스
2. **디지털 성숙도**: 디지털 전환 단계, 데이터 활용 수준 추정
3. **Amplitude 기회 분석**:
   - 어떤 제품/서비스에서 Amplitude가 필요한지
   - 예상 사용 사례 (퍼널 분석, 리텐션, A/B 테스트 등)
   - 경쟁사/현재 사용 툴 추정
4. **세일즈 전략 제안**:
   - 주요 접근 포인트 (어떤 임원/팀)
   - 예상 페인 포인트
   - 추천 미팅 어젠다
   - 주의사항/리스크

분석은 구체적이고 실행 가능하게 작성해주세요. 한국어로 응답하세요."""


class AIService:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    async def analyze_company(self, blueprint: CompanyBlueprint) -> dict:
        """기업 데이터를 종합 분석하여 AE 전략 생성"""
        try:
            # 분석용 데이터 정리
            company_data = _build_analysis_prompt(blueprint)

            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                system=ANALYSIS_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": company_data}],
            )

            full_analysis = message.content[0].text

            # 섹션별 분리
            sections = _parse_analysis_sections(full_analysis)

            return {
                "full_analysis": full_analysis,
                "ai_analysis": sections.get("overview", full_analysis[:500]),
                "amplitude_opportunity": sections.get("opportunity", ""),
                "recommended_strategy": sections.get("strategy", ""),
            }
        except Exception as e:
            print(f"AI analysis error: {e}")
            return {
                "full_analysis": "",
                "ai_analysis": "AI 분석을 불러올 수 없습니다.",
                "amplitude_opportunity": "",
                "recommended_strategy": "",
            }

    async def generate_email_draft(
        self,
        blueprint: CompanyBlueprint,
        purpose: str,
        recipient_name: str,
        recipient_title: str,
    ) -> str:
        """영업 이메일 초안 생성"""
        try:
            prompt = f"""
다음 기업에 Amplitude를 소개하는 영업 이메일을 작성해주세요.

수신자: {recipient_name} {recipient_title}
기업명: {blueprint.company_name}
목적: {purpose}
기업 요약: {blueprint.description or ""}
주요 서비스: {', '.join([s.name for s in blueprint.web_services[:3]])}
최근 뉴스: {blueprint.recent_news[0].title if blueprint.recent_news else "없음"}

요구사항:
- 200-300자 분량 (한국어)
- 개인화된 오프닝 (최근 뉴스나 회사 성과 언급)
- Amplitude 핵심 가치 1-2개만 집중
- 명확한 CTA (미팅 요청)
- 과도한 세일즈 문구 지양
"""
            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text
        except Exception as e:
            print(f"Email draft error: {e}")
            return "이메일 초안 생성 중 오류가 발생했습니다."

    async def refine_strategy(self, blueprint: CompanyBlueprint, user_notes: str) -> str:
        """AE의 메모/생각을 바탕으로 전략 보완"""
        try:
            prompt = f"""
기업: {blueprint.company_name}
수집된 정보 요약: {blueprint.ai_analysis or ""}
AE 메모/현재 전략: {user_notes}

위 내용을 바탕으로 전략을 보완하고 다음 액션 아이템을 제안해주세요:
1. 즉시 실행 가능한 액션 3가지
2. 이번 주 안에 할 일
3. 다음 미팅 준비 사항
"""
            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text
        except Exception as e:
            print(f"Strategy refinement error: {e}")
            return "전략 보완 중 오류가 발생했습니다."


def _build_analysis_prompt(blueprint: CompanyBlueprint) -> str:
    """분석용 프롬프트 구성"""
    lines = [
        f"# 기업명: {blueprint.company_name}",
        f"대표이사: {blueprint.ceo or '미확인'}",
        f"업종: {blueprint.industry or '미확인'}",
        f"임직원수: {blueprint.employees or '미확인'}",
        f"설립년도: {blueprint.founded or '미확인'}",
        f"홈페이지: {blueprint.website or '미확인'}",
        "",
    ]

    if blueprint.description:
        lines.append(f"## 기업 설명\n{blueprint.description}\n")

    if blueprint.executives:
        lines.append("## 임원진")
        for e in blueprint.executives[:10]:
            lines.append(f"- {e.name}: {e.title}")
        lines.append("")

    if blueprint.subsidiaries:
        lines.append("## 계열사/자회사")
        for s in blueprint.subsidiaries[:15]:
            lines.append(f"- {s.name} ({s.relation or '계열사'})")
        lines.append("")

    if blueprint.web_services:
        lines.append("## 웹 서비스")
        for s in blueprint.web_services[:10]:
            lines.append(f"- {s.name}: {s.url or ''}")
        lines.append("")

    if blueprint.apps:
        lines.append("## 앱 서비스")
        for a in blueprint.apps:
            lines.append(f"- {a.name} ({a.platform})")
        lines.append("")

    if blueprint.recent_news:
        lines.append("## 최근 뉴스")
        for n in blueprint.recent_news[:5]:
            lines.append(f"- [{n.date or ''}] {n.title}")
            if n.summary:
                lines.append(f"  {n.summary[:100]}")
        lines.append("")

    return "\n".join(lines)


def _parse_analysis_sections(text: str) -> dict:
    """AI 응답 텍스트를 섹션별로 파싱"""
    sections = {}
    current_section = "overview"
    current_content = []

    for line in text.split("\n"):
        if "기회" in line or "Amplitude" in line and "분석" in line:
            sections[current_section] = "\n".join(current_content).strip()
            current_section = "opportunity"
            current_content = []
        elif "전략" in line or "액션" in line or "제안" in line:
            sections[current_section] = "\n".join(current_content).strip()
            current_section = "strategy"
            current_content = []
        else:
            current_content.append(line)

    sections[current_section] = "\n".join(current_content).strip()
    return sections
