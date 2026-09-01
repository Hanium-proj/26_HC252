"""[담당 B] 도구별 신뢰도 계산.

같은 confidence 0.9 라도 classifier 의 0.9 와 VQA 의 0.9 는 무게가 다르다.
그 차이를 여기서 흡수한다.
"""

from __future__ import annotations

from app.schemas.common import EvidenceType, ToolName
from app.trust.normalize import Normalized

# 도구별 사전 신뢰도. 검증 데이터셋으로 캘리브레이션한 값으로 대체할 것.
TOOL_PRIOR: dict[ToolName, float] = {
    ToolName.CLASSIFIER: 0.90,
    ToolName.QUANTIFIER: 0.80,
    ToolName.LOCALIZER: 0.70,
    ToolName.VQA: 0.60,
    ToolName.KNOWLEDGE: 0.75,
    ToolName.CASE: 0.55,
    ToolName.GATEKEEPER: 0.0,  # 품질 측정기이며 소견 근거가 아니다
}

# 근거 성격별 가중치. 영상은 이 환자의 개별 사실이고 문헌은 일반론이므로
# 충돌 시 영상을 우선한다.
TYPE_WEIGHT: dict[EvidenceType, float] = {
    EvidenceType.MODEL: 1.00,
    EvidenceType.LITERATURE: 0.80,
    EvidenceType.CASE: 0.65,
}

# 입력 품질이 이 값 아래면 근거로 채택하지 않는다. 모델이 아무리 확신해도
# 판독 불가능한 영상에서 나온 판정은 근거가 될 수 없다.
QUALITY_FLOOR = 0.25


def score(n: Normalized) -> float:
    """정규화된 근거 하나의 신뢰도를 0~1 로 환산한다.

        신뢰도 = 도구 사전확률 x 근거성격 가중치 x confidence x quality

    quality 가 바닥값 미만이면 0 으로 떨어뜨린다. 곱셈만으로는 낮은 품질이
    높은 confidence 에 가려지기 때문이다.
    검증 대상이 특정되지 않은 근거도 0 으로 둔다. 무엇에 대한 근거인지
    모르는 것은 근거가 아니다.
    """
    if not n.usable or n.quality < QUALITY_FLOOR:
        return 0.0
    prior = TOOL_PRIOR.get(n.item.source, 0.5)
    type_w = TYPE_WEIGHT.get(n.item.evidence_type, 0.5)
    return round(prior * type_w * n.item.confidence * n.quality, 4)
