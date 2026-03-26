"""
웹 검색 및 스크래핑 서비스
- 회사 공식 사이트, 뉴스, 앱 정보 수집
"""
import httpx
import re
from bs4 import BeautifulSoup
from typing import Optional
from ..models.company import NewsItem, AppInfo, BusinessService


class SearchService:
    def __init__(self, serpapi_key: Optional[str] = None):
        self.serpapi_key = serpapi_key
        self.client = httpx.AsyncClient(
            timeout=20.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
            follow_redirects=True,
        )

    async def search_web(self, query: str, num: int = 10) -> list[dict]:
        """SerpAPI를 사용한 웹 검색 (키 없으면 네이버 검색 폴백)"""
        if self.serpapi_key:
            return await self._serpapi_search(query, num)
        return await self._naver_search(query, num)

    async def _serpapi_search(self, query: str, num: int) -> list[dict]:
        try:
            resp = await self.client.get(
                "https://serpapi.com/search",
                params={
                    "q": query,
                    "api_key": self.serpapi_key,
                    "num": num,
                    "hl": "ko",
                    "gl": "kr",
                },
            )
            data = resp.json()
            results = []
            for item in data.get("organic_results", []):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    }
                )
            return results
        except Exception as e:
            print(f"SerpAPI error: {e}")
            return []

    async def _naver_search(self, query: str, num: int) -> list[dict]:
        """네이버 검색 (폴백용)"""
        try:
            resp = await self.client.get(
                "https://search.naver.com/search.naver",
                params={"query": query, "display": num},
            )
            soup = BeautifulSoup(resp.text, "lxml")
            results = []
            for item in soup.select(".total_area")[:num]:
                title_el = item.select_one(".title_link, .api_txt_lines")
                link_el = item.select_one("a[href]")
                desc_el = item.select_one(".dsc_txt, .total_dsc")
                if title_el:
                    results.append(
                        {
                            "title": title_el.get_text(strip=True),
                            "url": link_el["href"] if link_el else "",
                            "snippet": desc_el.get_text(strip=True) if desc_el else "",
                        }
                    )
            return results
        except Exception as e:
            print(f"Naver search error: {e}")
            return []

    async def get_recent_news(self, company_name: str, limit: int = 10) -> list[NewsItem]:
        """회사 관련 최신 뉴스 수집"""
        news_items = []
        try:
            # 네이버 뉴스 검색
            resp = await self.client.get(
                "https://search.naver.com/search.naver",
                params={"where": "news", "query": company_name, "sort": 1, "display": limit},
            )
            soup = BeautifulSoup(resp.text, "lxml")

            for item in soup.select(".news_area, .bx")[:limit]:
                title_el = item.select_one(".news_tit, a.title_link")
                date_el = item.select_one(".info_group .info, .date")
                desc_el = item.select_one(".news_dsc, .dsc_txt_wrap")
                source_el = item.select_one(".info_group .press, .info_press")

                if title_el:
                    news_items.append(
                        NewsItem(
                            title=title_el.get_text(strip=True),
                            url=title_el.get("href", ""),
                            date=date_el.get_text(strip=True) if date_el else None,
                            summary=desc_el.get_text(strip=True)[:200] if desc_el else None,
                            source=source_el.get_text(strip=True) if source_el else "네이버뉴스",
                        )
                    )
        except Exception as e:
            print(f"News fetch error: {e}")

        return news_items

    async def get_website_info(self, url: str) -> dict:
        """회사 공식 홈페이지 기본 정보 스크래핑"""
        try:
            resp = await self.client.get(url)
            soup = BeautifulSoup(resp.text, "lxml")

            title = soup.find("title")
            description = soup.find("meta", attrs={"name": "description"}) or soup.find(
                "meta", attrs={"property": "og:description"}
            )

            # 서비스 링크 추출
            services = []
            for a in soup.select("nav a, .gnb a, .menu a")[:20]:
                href = a.get("href", "")
                text = a.get_text(strip=True)
                if text and len(text) > 1 and href:
                    services.append({"text": text, "href": href})

            return {
                "title": title.get_text(strip=True) if title else "",
                "description": description.get("content", "") if description else "",
                "services": services,
            }
        except Exception as e:
            print(f"Website scrape error: {e}")
            return {}

    async def search_apps(self, company_name: str) -> list[AppInfo]:
        """구글 플레이스토어에서 앱 검색"""
        apps = []
        try:
            resp = await self.client.get(
                "https://play.google.com/store/search",
                params={"q": company_name, "c": "apps", "hl": "ko"},
            )
            soup = BeautifulSoup(resp.text, "lxml")

            for item in soup.select("[data-uitype='500']")[:10]:
                name_el = item.select_one("[itemprop='name'], .WsMG1c")
                if name_el:
                    app_name = name_el.get_text(strip=True)
                    # 회사명 포함 여부 확인 (느슨하게)
                    if any(kw in app_name for kw in [company_name[:3]]):
                        link_el = item.select_one("a[href*='/store/apps/']")
                        apps.append(
                            AppInfo(
                                name=app_name,
                                platform="Android",
                                store_url=(
                                    "https://play.google.com" + link_el["href"]
                                    if link_el
                                    else None
                                ),
                            )
                        )
        except Exception as e:
            print(f"App search error: {e}")

        return apps[:5]

    async def close(self):
        await self.client.aclose()
