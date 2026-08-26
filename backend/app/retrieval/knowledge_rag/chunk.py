"""[담당 B] 3단계 - Chunking."""

from __future__ import annotations

from typing import Any


def chunk(doc: dict[str, Any], size: int = 512, overlap: int = 64) -> list[dict[str, Any]]:
    """섹션 경계를 존중하며 문서를 검색 단위로 쪼갠다.

    각 chunk 는 출처 메타(PMID, 섹션명)를 반드시 들고 있어야 한다.
    출처 없는 chunk 는 인용을 만들 수 없어 최종 답변에 쓸 수 없다.
    """
    raise NotImplementedError("담당 B: chunking 구현")
