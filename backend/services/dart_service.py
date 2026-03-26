"""
DART(금융감독원 전자공시시스템) API 연동 서비스
API 키 발급: https://opendart.fss.or.kr/
"""
import httpx
import zipfile
import io
import xml.etree.ElementTree as ET
from typing import Optional
from ..models.company import Executive, Subsidiary


DART_BASE_URL = "https://opendart.fss.or.kr/api"


class DartService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=30.0)

    async def search_company(self, company_name: str) -> list[dict]:
        """회사명으로 DART 기업 검색"""
        try:
            # DART 기업코드 전체 목록 다운로드 후 검색
            resp = await self.client.get(
                f"{DART_BASE_URL}/corpCode.xml",
                params={"crtfc_key": self.api_key},
            )
            if resp.status_code != 200:
                return []

            # ZIP 파일 압축 해제
            with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
                xml_content = z.read("CORPCODE.xml")

            root = ET.fromstring(xml_content)
            results = []
            for item in root.findall("list"):
                name = item.findtext("corp_name", "")
                if company_name.lower() in name.lower():
                    results.append(
                        {
                            "corp_code": item.findtext("corp_code", ""),
                            "corp_name": name,
                            "stock_code": item.findtext("stock_code", ""),
                            "modify_date": item.findtext("modify_date", ""),
                        }
                    )
            return results[:20]
        except Exception as e:
            print(f"DART search error: {e}")
            return []

    async def get_company_info(self, corp_code: str) -> Optional[dict]:
        """기업 기본 정보 조회"""
        try:
            resp = await self.client.get(
                f"{DART_BASE_URL}/company.json",
                params={"crtfc_key": self.api_key, "corp_code": corp_code},
            )
            data = resp.json()
            if data.get("status") == "000":
                return data
            return None
        except Exception as e:
            print(f"DART company info error: {e}")
            return None

    async def get_executives(self, corp_code: str) -> list[Executive]:
        """임원 현황 조회 (최신 사업보고서 기준)"""
        try:
            # 최근 보고서 목록 조회
            resp = await self.client.get(
                f"{DART_BASE_URL}/list.json",
                params={
                    "crtfc_key": self.api_key,
                    "corp_code": corp_code,
                    "bgn_de": "20230101",
                    "pblntf_ty": "A",  # 사업보고서
                    "page_count": 5,
                },
            )
            data = resp.json()
            if data.get("status") != "000" or not data.get("list"):
                return []

            # 가장 최근 보고서 rcept_no
            rcept_no = data["list"][0]["rcept_no"]

            # 임원 현황 조회
            resp2 = await self.client.get(
                f"{DART_BASE_URL}/exctvSttus.json",
                params={
                    "crtfc_key": self.api_key,
                    "corp_code": corp_code,
                    "bsns_year": data["list"][0]["rcept_dt"][:4],
                    "reprt_code": "11011",  # 사업보고서
                },
            )
            data2 = resp2.json()
            if data2.get("status") != "000":
                return []

            executives = []
            seen = set()
            for item in data2.get("list", []):
                name = item.get("nm", "").strip()
                title = item.get("ofcps", "").strip()
                if name and name not in seen:
                    seen.add(name)
                    executives.append(Executive(name=name, title=title))
            return executives
        except Exception as e:
            print(f"DART executives error: {e}")
            return []

    async def get_subsidiaries(self, corp_code: str) -> list[Subsidiary]:
        """계열사/자회사 현황 조회"""
        try:
            resp = await self.client.get(
                f"{DART_BASE_URL}/affiSttus.json",
                params={
                    "crtfc_key": self.api_key,
                    "corp_code": corp_code,
                    "bsns_year": "2023",
                    "reprt_code": "11011",
                },
            )
            data = resp.json()
            if data.get("status") != "000":
                return []

            subsidiaries = []
            for item in data.get("list", []):
                subsidiaries.append(
                    Subsidiary(
                        name=item.get("affi_corp_nm", ""),
                        relation=item.get("affi_reln", "계열사"),
                    )
                )
            return subsidiaries
        except Exception as e:
            print(f"DART subsidiaries error: {e}")
            return []

    async def close(self):
        await self.client.aclose()
