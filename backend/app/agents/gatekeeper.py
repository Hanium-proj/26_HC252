"""[담당 A] Gatekeeper - 파이프라인 진입 전 필터링 및 입력 품질 측정.

두 가지 역할을 한다.

1. check()   질문이 이 시스템의 응답 범위인지 판정한다.
2. inspect() 입력 영상의 품질을 측정해 EvidenceItem 으로 보고한다.

inspect 가 보고하는 quality 는 packet_quality 를 통해 모든 영상 근거에
전파된다(app/trust/normalize.py). 품질이 0.25 미만이면 분류기가 아무리
확신해도 신뢰도가 0 이 되므로, 이 값이 파이프라인 전체의 안전장치가 된다.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem
from app.tools.vision._store import get_store

# 영상 근거가 반드시 필요한 질문 유형에서 영상이 없으면 차단한다.
_IMAGE_REQUIRED_HINTS = (
    "이 영상", "이 사진", "x-ray", "엑스레이", "여기에", "어디에",
    "보이", "판독", "소견",
)

# 진단 범위 밖. 이 시스템은 처방과 예후 단정을 하지 않는다.
_OUT_OF_SCOPE = (
    "처방", "약을 먹", "복용량", "수술해야", "몇 개월", "생존",
    "완치", "죽", "사망률",
)

# 지시문 주입 시도.
_INJECTION = (
    "ignore previous", "이전 지시", "시스템 프롬프트", "프롬프트를 무시",
    "너의 지침", "system prompt",
)


@dataclass
class GateResult:
    allowed: bool
    reason: str = ""


def check(query: str, has_image: bool) -> GateResult:
    """질문이 이 시스템이 답할 수 있는 범위인지 판정한다."""
    q = (query or "").strip().lower()

    if not q:
        return GateResult(False, "질문이 비어 있음")

    for pat in _INJECTION:
        if pat in q:
            return GateResult(False, "지시문 주입 시도로 판단하여 차단")

    for pat in _OUT_OF_SCOPE:
        if pat in q:
            return GateResult(
                False,
                "처방·예후 단정은 본 시스템의 응답 범위가 아님. "
                "영상 소견과 그 근거 제시로 한정된다",
            )

    if not has_image and any(h in q for h in _IMAGE_REQUIRED_HINTS):
        return GateResult(False, "영상 근거가 필요한 질문이나 영상이 제공되지 않음")

    return GateResult(True)


async def inspect(image_ref: str | None) -> EvidenceItem | None:
    """입력 영상의 촬영 자세와 품질을 측정해 보고한다.

    품질은 촬영 자세 기반 휴리스틱이다(app/tools/vision/_store.py VIEW_QUALITY).
    학습과 CAM 평가가 정면 영상만 사용했으므로 측면 영상은 분포 밖 입력으로
    낮게 잡는다. 학습된 품질 판정 모델이 아니라는 점을 metadata 에 남긴다.
    """
    if not image_ref:
        return None

    pred = get_store().get(image_ref)
    if pred is None:
        return None

    return EvidenceItem(
        source=ToolName.GATEKEEPER,
        claim=f"{{'view': '{pred.view}', 'quality': {pred.quality}}}",
        evidence_type=EvidenceType.MODEL,
        confidence=pred.quality,
        metadata={
            "view": pred.view,
            "quality": pred.quality,
            "dicom_id": pred.dicom_id,
            "study_id": pred.study_id,
            "quality_source": "view_heuristic",
            "caveat": "학습된 품질 판정 모델이 아니라 촬영 자세 기반 휴리스틱",
        },
    )
