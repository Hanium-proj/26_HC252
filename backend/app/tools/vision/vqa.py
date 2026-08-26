"""[담당 A] 영상 질의응답."""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem


async def ask(image_ref: str, **kwargs) -> list[EvidenceItem]:
    """영상 + 자연어 질문으로 국소 소견을 확인. result=str.

    반환값은 반드시 EvidenceItem 리스트여야 한다. confidence 와 quality 를
    빠뜨리면 담당 B 의 Trust 계산이 성립하지 않는다.
    """
    raise NotImplementedError("담당 A: 영상 질의응답 구현")
