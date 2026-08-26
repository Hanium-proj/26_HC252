"""[담당 A] 질환 존재 여부 분류."""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem


async def classify(image_ref: str, **kwargs) -> list[EvidenceItem]:
    """영상에서 질환별 확률을 산출해 EvidenceItem(result=bool) 로 반환.

    반환값은 반드시 EvidenceItem 리스트여야 한다. confidence 와 quality 를
    빠뜨리면 담당 B 의 Trust 계산이 성립하지 않는다.
    """
    raise NotImplementedError("담당 A: 질환 존재 여부 분류 구현")
