"""
계정별 키워드 매핑 - 이메일/캘린더/슬랙에서 계정을 식별하는 데 사용
"""

ACCOUNT_KEYWORDS: dict[str, list[str]] = {
    "TVING": [
        "tving", "티빙", "yb.lee10@cj.net", "cjons", "서비스플래닝",
    ],
    # 더 구체적인 키워드를 CJ Olive Young 위에 배치 (서브스트링 매칭 방지)
    "CJ Olive Young Global": [
        "올리브영글로벌", "oliveyoung global", "cj olive young global", "olive young global",
        "올리브영 글로벌",
    ],
    "CJ Olive Young": [
        "olive young", "올리브영", "oliveyoung", "cj olive",
    ],
    "하이마트": [
        "하이마트", "himart", "hi-mart", "maxonomy", "마소노미",
        "sohyun.park11@cj.net", "cj올리브네트웍스",
    ],
    "Lotte Shopping": [
        "롯데온", "lotteon", "lotte on", "martinee", "마티니",
        "@lotte.net", "lotte shopping",
    ],
    "Lotte Members": [
        "롯데멤버스", "lotte members", "롯데포인트",
    ],
    "Starbucks Korea": [
        "starbucks", "스타벅스", "@starbucks.co.kr", "sbux",
    ],
    "SSG.com": [
        "ssg.com", "ssg닷컴", "쓱닷컴", "@ssg.com", "ssg커머스", "ssg commerce",
    ],
    "Shinsegae Live Shopping": [
        "신세계라이브", "shinsegae live", "쓱라이브", "ssg live",
    ],
    "GS Retail": [
        "gs retail", "gs리테일", "gs25", "@gsretail.com", "gs수퍼",
    ],
    "LG Uplus (CTO)": [
        "lg uplus", "uplus", "유플러스", "@uplus.co.kr", "lg유플러스",
    ],
    "Golfzon County": [
        "golfzon", "골프존", "golfzon county",
    ],
    "KT Alpha": [
        "kt alpha", "kt알파", "@ktalpha",
    ],
    "SK Telecom (IFLAND)": [
        "ifland", "sk telecom", "sk텔레콤", "skt", "sk adot",
    ],
    "Samsung Next (US)": [
        "samsung next", "삼성넥스트", "@samsungnext",
    ],
    "Samsung Galaxy Store": [
        "galaxy store", "갤럭시스토어", "samsung galaxy store", "galaxy app store",
    ],
    "Samsung Shop (Samsung.com)": [
        "samsung.com", "samsung shop", "삼성닷컴", "samsung store",
    ],
    "SPC (Secta9ine)": [
        "spc", "secta9ine", "섹나나인", "@spc.co.kr", "파리바게뜨",
        "paris baguette", "baskin", "hyungjin.cho",
    ],
    "야놀자 (NOL Universe)": [
        "야놀자", "yanolja", "nol universe", "@yanolja.com", "놀유니버스",
    ],
    "인터파크트리플": [
        "인터파크", "interpark", "트리플", "triple", "@interpark.com",
        "interparktriple",
    ],
    "Dunamu": [
        "두나무", "dunamu", "upbit", "업비트", "@dunamu.com",
        "lambda 256", "람다256", "stockplus", "스톡플러스",
    ],
    "Musinsa": [
        "무신사", "musinsa", "@musinsa.com",
    ],
    "Wavve": [
        "wavve", "웨이브", "콘텐츠웨이브", "@wavve.com", "contentwavve",
    ],
    "Shinsegae Duty Free": [
        "신세계df", "신세계 df", "신세계면세점", "shinsegae df", "shinsegae duty free",
        "ssgdf", "ssg df",
    ],
    "Woori Card": [
        "우리카드", "woori card", "@wooricard.com", "woorikard", "wooricard",
    ],
    "Naver Corp": [
        "naver", "네이버", "@naver.com",
    ],
    "Hyundai Motor Group": [
        "hyundai motor", "현대차", "현대자동차", "genesis", "제네시스",
        "hyundai capital", "현대캐피탈",
    ],
    "Hyundai Department Store": [
        "현대백화점", "hyundai department", "h.point", "hpoint",
    ],
}

# 내부 amplitude 도메인 - 매칭에서 제외
INTERNAL_DOMAINS = [
    "@amplitude.com", "@ab180.co", "@martinee.io",
]

def match_account(text: str) -> str | None:
    """
    텍스트에서 계정 이름을 찾아 반환. 없으면 None.
    여러 계정 매칭 시 첫 번째 반환.
    """
    text_lower = text.lower()

    # 내부 도메인만 포함된 텍스트는 스킵
    is_internal_only = all(
        domain in text_lower
        for domain in INTERNAL_DOMAINS
        if domain in text_lower
    )

    for account, keywords in ACCOUNT_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                return account
    return None


def match_accounts_all(text: str) -> list[str]:
    """텍스트에서 매칭되는 모든 계정 반환"""
    text_lower = text.lower()
    matched = []
    for account, keywords in ACCOUNT_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                matched.append(account)
                break
    return matched
