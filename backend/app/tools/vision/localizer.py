"""[담당 A] CAM 기반 병변 위치 추정."""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem


async def localize(image_ref: str, **kwargs) -> list[EvidenceItem]:
    """Grad-CAM / Eigen-CAM 으로 heatmap 을 만들고 해부학적 위치명으로 변환.

    반환값은 반드시 EvidenceItem 리스트여야 한다. confidence 와 quality 를
    빠뜨리면 담당 B 의 Trust 계산이 성립하지 않는다.
    """
    raise NotImplementedError("담당 A: CAM 기반 병변 위치 추정 구현")
