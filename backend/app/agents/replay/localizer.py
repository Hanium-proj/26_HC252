"""[담당 A] CAM 기반 병변 위치 추정.

Grad-CAM / Eigen-CAM 결과와 ChestX-Det PSPNet 폐 분할 마스크로 산출한
해부학적 정합성 지표를 EvidenceItem 으로 변환한다.

중요 — 이 근거가 뜻하는 것:
    정합성 proxy 는 CAM 에너지가 폐야 안에 집중되어 있는지만 측정한다.
    병변 위치 정확도가 아니다. 병변 bounding box 주석이 없어 IoU 평가를
    수행하지 못했으므로, confidence 를 병변 국소화 확신도로 읽으면 안 된다.
    하류 설명 생성이 이를 "병변을 여기서 찾았다"로 서술해서는 안 된다.
"""

from __future__ import annotations

from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem
from app.tools.vision._store import get_store

# 정합성 proxy 통과 기준(생성 시점과 동일):
#   lung energy >= 0.65 AND edge/top energy <= 0.10
# Eigen-CAM 이 최종 백본에서 raw 통과율 90.0% 로 Grad-CAM(72.9%) 보다 안정적이어서
# 기본 시각화 기법으로 채택한다.
PREFERRED_METHOD = "eigen_cam"


async def localize(
    image_ref: str,
    targets: list[str] | None = None,
    **kwargs,
) -> list[EvidenceItem]:
    """소견별 CAM 정합성 근거를 반환한다.

    CAM 산출물이 없는 (영상, 소견) 조합은 근거를 만들지 않는다.
    필수 근거였다면 Trust 가 NEED_MORE_EVIDENCE 로 판정하게 되며,
    이는 "보지 않았다"를 "근거가 없다"와 구분하는 설계 의도에 맞다.
    """
    store = get_store()
    pred = store.get(image_ref)
    if pred is None:
        return []

    findings = targets or [f for f, _ in pred.top_findings(k=3)]
    items: list[EvidenceItem] = []

    for finding in findings:
        rec = store.cam(pred.dicom_id, finding)
        if rec is None:
            continue

        # raw 지표를 쓴다. 마스킹 후 값은 CNN 계열에서 100% 로 포화되어
        # 변별력이 없으므로 근거 강도로 사용할 수 없다.
        lung = rec.eigen_raw_lung if PREFERRED_METHOD == "eigen_cam" else rec.grad_raw_lung
        passed = rec.eigen_raw_pass if PREFERRED_METHOD == "eigen_cam" else rec.grad_raw_pass

        region = _region_label(lung, passed)
        items.append(
            EvidenceItem(
                source=ToolName.LOCALIZER,
                claim=f"{{'finding': '{finding}', 'region': '{region}'}}",
                evidence_type=EvidenceType.MODEL,
                confidence=round(float(lung), 4),
                metadata={
                    "finding": finding,
                    "region": region,
                    "quality": pred.quality,
                    "method": PREFERRED_METHOD,
                    "lung_energy_fraction": round(float(lung), 4),
                    "proxy_pass": bool(passed),
                    "grad_cam_raw_pass": rec.grad_raw_pass,
                    "eigen_cam_raw_pass": rec.eigen_raw_pass,
                    "overlay_path": rec.output_path,
                    "caveat": (
                        "정합성 proxy 는 폐야 집중도이며 병변 위치 정확도가 아님. "
                        "bbox IoU 미수행"
                    ),
                },
            )
        )
    return items


def _region_label(lung_energy: float, passed: bool) -> str:
    """정합성 지표를 서술 가능한 라벨로 바꾼다.

    좌/우, 상/하엽 같은 해부학적 세부 위치는 현재 산출물에 없다.
    없는 정보를 지어내지 않고 폐야 집중 여부만 보고한다.
    """
    if not passed:
        return "outside_lung_field"
    if lung_energy >= 0.90:
        return "lung_field_high_concentration"
    return "lung_field"
