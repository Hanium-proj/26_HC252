"""[담당 B] 질의 번역 - Phase 2 한국어 대응.

4.2절 측정에서 한국어 질의 Hit@8 이 0.750 으로, 동일 질문의 영문 표현(1.000)
대비 크게 낮았다. 코퍼스가 영문이라 질의-문서 간 유사도가 전반적으로 눌리고,
그 결과 정답과 비정답의 변별이 무너지는 것이 원인이었다.

번역을 검색 앞단에 두어 질의를 코퍼스 언어에 맞춘다.
"""

from __future__ import annotations

import re
from functools import lru_cache

from openai import AsyncOpenAI, OpenAI

from app.core.config import get_settings

# 한글 음절 블록. 한 글자라도 있으면 번역 대상으로 본다.
_HANGUL = re.compile(r"[가-힣]")

_SYSTEM = (
    "You translate Korean clinical questions about chest radiography into English. "
    "Output only the translated question. Preserve radiology terminology precisely "
    "(e.g. 기흉 -> pneumothorax, 흉수 -> pleural effusion, 무기폐 -> atelectasis, "
    "폐경화 -> consolidation, 종격동 -> mediastinum, 늑골 골절 -> rib fracture). "
    "Do not add commentary or explanation."
)


def needs_translation(text: str) -> bool:
    """한글이 포함되어 있으면 번역 대상으로 판정한다.

    언어 판별 라이브러리를 쓰지 않는 이유: 의학 질의는 영문 용어가 섞인
    한국어인 경우가 많아 통계적 판별기가 영어로 오판한다.
    """
    return bool(_HANGUL.search(text))


@lru_cache(maxsize=512)
def translate_query(text: str) -> str:
    """한국어 질의를 영어로 번역한다. 영어면 그대로 반환한다.

    검색 지연에 번역 왕복이 더해지므로 결과를 캐싱한다. 동일 질의가
    반복되는 임상 환경에서 효과가 크다.
    """
    if not needs_translation(text):
        return text

    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.chat.completions.create(
        model=settings.translate_model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": text},
        ],
        temperature=0,
    )
    return (resp.choices[0].message.content or text).strip()


async def atranslate_query(text: str) -> str:
    if not needs_translation(text):
        return text
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.chat.completions.create(
        model=settings.translate_model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": text},
        ],
        temperature=0,
    )
    return (resp.choices[0].message.content or text).strip()
