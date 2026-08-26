"""[담당 A] 정량화."""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem


async def quantify(image_ref: str, **kwargs) -> list[EvidenceItem]:
    """병변 크기/비율/심각도를 수치로 산출. result=float.

    반환값은 반드시 EvidenceItem 리스트여야 한다. confidence 와 quality 를
    빠뜨리면 담당 B 의 Trust 계산이 성립하지 않는다.
    """
    raise NotImplementedError("담당 A: 정량화 구현")
