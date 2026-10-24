"""[담당 A] 질환 존재 여부 분류.

ConvNeXt-Base 512 (U-MultiClass + EMA) 로 학습한 14소견 분류기의 결과를
EvidenceItem 으로 변환한다. 확률은 사전 산출된 test split 예측을 사용한다
(근거는 app/tools/vision/_store.py 참조).

metadata 규약(docs/INTERFACE.md):
    finding      - Trust 가 근거를 묶는 조인 키. 없으면 충돌 탐지가 불가능하다
    probability  - 소견 존재 판정의 근거
    quality      - packet_quality 로 전파되는 입력 품질
"""

from __future__ import annotations

import os

from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem
from app.tools.vision._store import get_store

# 이 확률 미만인 소견은 근거로 만들지 않는다. 14개 전부를 근거로 올리면
# 판정 대상이 아닌 소견까지 주장으로 세워져 Trust 출력이 오염된다.
MIN_REPORT_PROBABILITY = 0.05


async def classify(
    image_ref: str,
    targets: list[str] | None = None,
    top_k: int = 3,
    **kwargs,
) -> list[EvidenceItem]:
    """영상에서 질환별 확률을 산출해 EvidenceItem 리스트로 반환한다.

    targets 가 주어지면 해당 소견만, 없으면 상위 top_k 소견을 근거로 만든다.
    Planner 가 대상을 특정한 경우 그 소견에 집중하는 편이 Trust 판정에 유리하다.
    """
    store = get_store()
    pred = store.get(image_ref)
    if pred is None:
        return []

    quality = pred.quality
    items: list[EvidenceItem] = []

    if targets:
        pairs = []
        for t in targets:
            p = pred.probability(t)
            if p is not None:
                pairs.append((t, p))
    else:
        pairs = pred.top_findings(k=top_k)

    for finding, prob in pairs:
        # 대상 소견을 지정한 질문에서는 낮은 확률도 강한 반대 근거이므로 생략하지 않는다.
        # 하한은 대상 없이 상위 소견을 고를 때만 적용한다.
        if not targets and prob < MIN_REPORT_PROBABILITY:
            continue
        items.append(
            EvidenceItem(
                source=ToolName.CLASSIFIER,
                claim=f"{{'finding': '{finding}', 'probability': {round(prob, 4)}}}",
                evidence_type=EvidenceType.MODEL,
                confidence=round(float(prob), 4),
                metadata={
                    "finding": finding,
                    "probability": round(float(prob), 4),
                    "quality": quality,
                    "view": pred.view,
                    "dicom_id": pred.dicom_id,
                    "study_id": pred.study_id,
                    "model": os.getenv("GLASS_MODEL_NAME", "convnext_base_512_u_multiclass_ema"),
                },
            )
        )
    return items
