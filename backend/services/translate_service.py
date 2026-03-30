"""
번역 서비스 — Google Translate 비공식 API + 파일 기반 캐시
캐시: backend/data/translation_cache.json (재배포 후에도 유지 안됨, 인메모리 fallback)
"""
import json
import hashlib
import urllib.request
import urllib.parse
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).parent.parent / "data" / "translation_cache.json"
_mem_cache: dict = {}  # 서버 재시작 전까지 메모리 캐시


def _load_cache() -> dict:
    if _mem_cache:
        return _mem_cache
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            _mem_cache.update(data)
        except Exception:
            pass
    return _mem_cache


def _save_cache(cache: dict):
    try:
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def _has_korean(text: str) -> bool:
    return any('\uAC00' <= c <= '\uD7A3' for c in text)


def _google_translate(text: str, target: str = "en", source: str = "ko") -> str:
    """Google Translate 비공식 API 호출. 실패 시 원문 반환."""
    try:
        encoded = urllib.parse.quote(text[:800])
        url = (
            f"https://translate.googleapis.com/translate_a/single"
            f"?client=gtx&sl={source}&tl={target}&dt=t&q={encoded}"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return "".join(seg[0] for seg in data[0] if seg[0]).strip()
    except Exception as e:
        logger.warning(f"번역 실패: {e}")
        return text


def translate_texts(
    texts: list[str],
    target_lang: str = "en",
    source_lang: str = "ko",
) -> dict[str, str]:
    """
    texts 리스트를 번역해 {원문: 번역문} dict 반환.
    이미 캐시된 항목은 API 호출 안 함.
    한국어가 없는 텍스트는 그대로 반환.
    """
    cache = _load_cache()
    result: dict[str, str] = {}
    new_entries = False

    for text in texts:
        if not text or not text.strip():
            result[text] = text
            continue

        # 한국어 없으면 그대로
        if not _has_korean(text):
            result[text] = text
            continue

        cache_key = f"{source_lang}:{target_lang}:{hashlib.md5(text.encode()).hexdigest()}"
        if cache_key in cache:
            result[text] = cache[cache_key]
        else:
            translated = _google_translate(text, target=target_lang, source=source_lang)
            result[text] = translated
            cache[cache_key] = translated
            new_entries = True

    if new_entries:
        _save_cache(cache)

    return result
