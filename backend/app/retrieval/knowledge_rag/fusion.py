"""[담당 B] RRF 순위 융합 - Phase 2.

Reciprocal Rank Fusion 은 서로 다른 검색기의 점수 체계를 정규화하지 않고
*순위만* 사용해 결합한다. dense 의 코사인 유사도(0~1)와 BM25 점수(무제한 양수)는
스케일이 달라 직접 더할 수 없으므로 이 방식이 적합하다.

    score(d) = sum over retrievers of 1 / (k + rank(d))

k 는 상위 순위의 영향력을 조절한다. 표준값 60 을 사용한다.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from app.core.config import get_settings


def rrf(
    ranked_lists: Sequence[Sequence[Any]],
    key: Callable[[Any], str],
    k: int | None = None,
    weights: Sequence[float] | None = None,
) -> list[tuple[str, float, Any]]:
    """여러 순위 목록을 RRF 로 융합한다.

    반환: (식별자, 융합점수, 원본 항목) 목록. 점수 내림차순.
    원본 항목은 먼저 등장한 목록의 것을 유지한다.
    """
    kk = k if k is not None else get_settings().rrf_k
    ws = list(weights) if weights else [1.0] * len(ranked_lists)

    scores: dict[str, float] = {}
    items: dict[str, Any] = {}
    for lst, w in zip(ranked_lists, ws, strict=True):
        for rank, item in enumerate(lst, start=1):
            kid = key(item)
            scores[kid] = scores.get(kid, 0.0) + w / (kk + rank)
            items.setdefault(kid, item)

    return sorted(
        ((kid, s, items[kid]) for kid, s in scores.items()),
        key=lambda t: -t[1],
    )
