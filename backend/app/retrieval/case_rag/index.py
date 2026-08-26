"""[담당 B] 증례 인덱스 구축."""

from __future__ import annotations

from typing import Any


def build(cases: list[dict[str, Any]]) -> None:
    """과거 증례를 영상 임베딩 + 임상정보로 색인한다.

    개인정보: 증례 데이터는 반드시 비식별화된 것만 색인한다.
    원본 환자 식별자를 인덱스에 넣지 않는다.
    """
    raise NotImplementedError("담당 B: 증례 색인 구현")
