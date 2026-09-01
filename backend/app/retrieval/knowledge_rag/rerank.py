"""[담당 B] Cross-encoder 리랭킹 - Phase 2.

dense 와 BM25 는 질의와 문서를 각각 인코딩해 비교한다(bi-encoder). 반면
cross-encoder 는 질의와 문서를 함께 입력해 직접 관련도를 판정하므로 정확하지만
느리다. 따라서 융합 결과 상위 소수에만 적용한다.

4.2절에서 관측한 "유사도 분포 압축으로 변별력이 무너지는" 문제에 직접 대응한다.
"""

from __future__ import annotations

from collections.abc import Sequence
from functools import lru_cache
from typing import Any

from app.core.config import get_settings


@lru_cache(maxsize=1)
def _model():
    # import 를 함수 안에 두는 이유: sentence-transformers 는 torch 를 끌어와
    # 로딩이 무겁다. 리랭킹을 쓰지 않는 경로에서는 비용을 물지 않는다.
    from sentence_transformers import CrossEncoder

    return CrossEncoder(get_settings().rerank_model)


def rerank(
    query: str,
    items: Sequence[Any],
    text_of,
    top_k: int = 8,
) -> list[tuple[float, Any]]:
    """질의-문서 쌍을 직접 채점해 재정렬한다.

    반환: (점수, 항목) 목록. 점수 내림차순 상위 top_k.
    """
    if not items:
        return []
    pairs = [(query, text_of(it)) for it in items]
    scores = _model().predict(pairs)
    ranked = sorted(zip(scores, items, strict=True), key=lambda t: -float(t[0]))
    return [(float(s), it) for s, it in ranked[:top_k]]


def is_available() -> bool:
    """리랭커 사용 가능 여부. 미설치 환경에서 검색 전체가 실패하지 않게 한다."""
    try:
        import sentence_transformers  # noqa: F401
    except ImportError:
        return False
    return True
