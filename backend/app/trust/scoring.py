"""[담당 B] 도구별 신뢰도 계산.

같은 confidence 0.9 라도 classifier 의 0.9 와 VQA 의 0.9 는 무게가 다르다.
그 차이를 여기서 흡수한다.
"""

from __future__ import annotations

from app.schemas.common import EvidenceKind, ToolName
from app.schemas.evidence import EvidenceItem

# 도구별 사전 신뢰도. 검증 데이터셋으로 캘리브레이션한 값으로 대체할 것.
TOOL_PRIOR: dict[ToolName, float] = {
    ToolName.CLASSIFIER: 0.90,
    ToolName.QUANTIFIER: 0.80,
    ToolName.LOCALIZER: 0.70,
    ToolName.VQA: 0.60,
    ToolName.KNOWLEDGE_RAG: 0.75,
    ToolName.CASE_RAG: 0.55,
}

# 근거 성격별 가중치. 영상은 이 환자의 개별 사실이고 문헌은 일반론이므로
# 충돌 시 영상을 우선한다.
KIND_WEIGHT: dict[EvidenceKind, float] = {
    EvidenceKind.IMAGE: 1.00,
    EvidenceKind.LITERATURE: 0.80,
    EvidenceKind.CASE: 0.65,
}

# 입력 품질이 이 값 아래면 근거로 채택하지 않는다. 모델이 아무리 확신해도
# 판독 불가능한 영상에서 나온 판정은 근거가 될 수 없다.
QUALITY_FLOOR = 0.25


def score(item: EvidenceItem) -> float:
    """EvidenceItem 하나의 신뢰도를 0~1 로 환산한다.

        신뢰도 = 도구 사전확률 x 근거성격 가중치 x confidence x quality

    quality 가 바닥값 미만이면 0 으로 떨어뜨린다. 곱셈만으로는 낮은 품질이
    높은 confidence 에 가려지기 때문이다.
    """
    if item.quality < QUALITY_FLOOR:
        return 0.0
    prior = TOOL_PRIOR.get(item.tool, 0.5)
    kind_w = KIND_WEIGHT.get(item.kind, 0.5)
    return round(prior * kind_w * item.confidence * item.quality, 4)


def is_positive(item: EvidenceItem) -> bool | None:
    """근거가 주장을 지지하는지 판정한다.

    result 타입이 도구마다 달라 해석 규칙이 필요하다.
      bool  - classifier / case_rag 집계. 그대로 사용
      float - quantifier. 0 초과면 소견 존재로 본다
      str   - vqa / knowledge_rag. 판정 불가이므로 None 을 반환해
              지지/반대 어느 쪽으로도 세지 않는다
    """
    r = item.result
    if isinstance(r, bool):
        return r
    if isinstance(r, int | float):
        return r > 0
    return None
