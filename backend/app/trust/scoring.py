"""[담당 B] 도구별 신뢰도 계산.

같은 confidence 0.9 라도 classifier 의 0.9 와 VQA 의 0.9 는 무게가 다르다.
그 차이를 여기서 흡수한다.
"""

from __future__ import annotations

from app.schemas.common import ToolName
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


def score(item: EvidenceItem) -> float:
    """EvidenceItem 하나의 신뢰도를 0~1 로 환산한다.

    기본형: TOOL_PRIOR[tool] * confidence * quality
    개선 여지:
      - confidence 캘리브레이션 (딥러닝 모델은 과확신 경향이 있음)
      - quality 가 임계값 미만이면 아예 0 으로 떨어뜨리는 게이트
    """
    raise NotImplementedError("담당 B: 신뢰도 계산 구현")
