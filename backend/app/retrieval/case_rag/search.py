"""[담당 B] 유사 증례 검색."""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem


async def search(image_ref: str, claim: str, top_k: int = 3) -> list[EvidenceItem]:
    """유사 증례를 찾아 EvidenceItem(kind=CASE) 로 반환한다.

    quality 는 증례 수가 적을수록 낮게 잡는다. 유사 증례 2건으로 내린 판단과
    200건으로 내린 판단은 같은 무게일 수 없다.
    """
    raise NotImplementedError("담당 B: 증례 검색 구현")
