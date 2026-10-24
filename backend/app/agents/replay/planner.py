"""[담당 A] Query & Evidence Planner - 파이프라인 전체 라우팅의 시작점.

질문을 8개 유형 중 하나로 분류하고, 그 유형에 필요한 근거와 도구 호출 순서,
그리고 RAG 검색어를 결정한다.

LLM 이 가용하면 GPT 로 분류하고, 실패하거나 키가 없으면 키워드 규칙으로
폴백한다. 폴백이 있어야 API 없이도 전체 파이프라인을 재현할 수 있다.

required_evidence 항목명은 임의로 지으면 안 된다. Trust 가
EVIDENCE_TOOL_KEYWORDS(app/schemas/evidence.py)로 담당 도구를 역추적해
근거 결손을 판정하기 때문이다. 새 항목명을 추가할 때는 그 표도 함께 갱신한다.
"""

from __future__ import annotations

import json
import os

from app.schemas.common import TaskType, ToolName
from app.schemas.query import Plan, QueryInput

# 질문 유형별 필요 근거와 도구 순서.
# gatekeeper 는 항상 선행한다. 입력 품질이 모든 영상 근거에 전파되기 때문이다.
_PROFILES: dict[TaskType, dict[str, list]] = {
    TaskType.FINDING_PRESENCE: {
        "required": ["classifier_prediction", "cam_localization"],
        "supporting": ["knowledge_criteria", "similar_case_agreement"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER, ToolName.LOCALIZER],
    },
    TaskType.FINDING_LOCATION: {
        "required": ["classifier_prediction", "cam_localization"],
        "supporting": ["knowledge_criteria"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER, ToolName.LOCALIZER],
    },
    TaskType.REPORT_GENERATION: {
        "required": ["view_quality", "classifier_prediction", "cam_localization"],
        "supporting": ["similar_case_agreement"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER, ToolName.LOCALIZER],
    },
    TaskType.EVIDENCE_EXPLANATION: {
        "required": ["classifier_prediction", "cam_localization"],
        "supporting": ["knowledge_criteria"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER, ToolName.LOCALIZER],
    },
    TaskType.CLINICAL_GUIDANCE: {
        "required": ["classifier_prediction", "knowledge_guideline"],
        "supporting": ["similar_case_agreement"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER],
    },
    TaskType.LITERATURE_SEARCH: {
        "required": ["knowledge_guideline"],
        "supporting": [],
        "tools": [],
    },
    TaskType.TEMPORAL_COMPARISON: {
        "required": ["classifier_prediction"],
        "supporting": ["similar_case_agreement"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER],
    },
    TaskType.UNCERTAINTY_CHECK: {
        "required": ["classifier_prediction", "view_quality"],
        "supporting": ["knowledge_criteria", "similar_case_agreement"],
        "tools": [ToolName.GATEKEEPER, ToolName.CLASSIFIER, ToolName.LOCALIZER],
    },
}

# 규칙 기반 분류용 키워드. 위에서부터 먼저 맞는 것을 채택한다.
_RULES: list[tuple[TaskType, tuple[str, ...]]] = [
    (TaskType.LITERATURE_SEARCH, ("문헌", "논문", "가이드라인", "기준을 찾", "근거 문헌")),
    (TaskType.CLINICAL_GUIDANCE, ("추가 검사", "다음에 어떤", "어떻게 해야", "권고", "후속")),
    (TaskType.TEMPORAL_COMPARISON, ("지난", "이전", "비교", "좋아졌", "나빠졌", "변화")),
    (TaskType.UNCERTAINTY_CHECK, ("얼마나 믿", "확실", "신뢰", "불확실", "정확한가")),
    (TaskType.EVIDENCE_EXPLANATION, ("왜", "근거", "이유", "어떻게 판단")),
    (TaskType.REPORT_GENERATION, ("판독문", "보고서", "리포트", "report")),
    (TaskType.FINDING_LOCATION, ("어디", "위치", "부위", "어느 쪽")),
]

# 소견 한국어 표기 -> CheXpert 라벨. 질문에서 대상을 추출할 때 쓴다.
_FINDING_ALIASES: dict[str, str] = {
    "기흉": "Pneumothorax",
    "폐렴": "Pneumonia",
    "흉수": "Pleural Effusion",
    "심비대": "Cardiomegaly",
    "무기폐": "Atelectasis",
    "폐부종": "Edema",
    "부종": "Edema",
    "경화": "Consolidation",
    "폐음영": "Lung Opacity",
    "결절": "Lung Lesion",
    "골절": "Fracture",
    "종격동": "Enlarged Cardiomediastinum",
    "의료기기": "Support Devices",
    "pneumothorax": "Pneumothorax",
    "pneumonia": "Pneumonia",
    "effusion": "Pleural Effusion",
    "cardiomegaly": "Cardiomegaly",
    "atelectasis": "Atelectasis",
    "edema": "Edema",
    "consolidation": "Consolidation",
}


def extract_targets(question: str) -> list[str]:
    """질문에서 검증 대상 소견을 뽑는다.

    찾지 못하면 빈 리스트를 반환한다. 임의로 소견을 채우지 않는 이유는
    Trust 가 finding='unknown' 근거를 계산에서 제외하도록 설계되어 있고,
    없는 대상을 지어내면 존재하지 않는 소견을 승인하게 되기 때문이다.
    """
    q = (question or "").lower()
    found: list[str] = []
    for alias, label in _FINDING_ALIASES.items():
        if alias.lower() in q and label not in found:
            found.append(label)
    return found


def classify(question: str) -> TaskType:
    """키워드 규칙으로 질문 유형을 판정한다."""
    q = (question or "").lower()
    for task, keywords in _RULES:
        if any(k in q for k in keywords):
            return task
    return TaskType.FINDING_PRESENCE


def plan(query: QueryInput, use_llm: bool | None = None) -> Plan:
    """질문을 분류하고 근거·도구 계획을 만든다."""
    if use_llm is None:
        use_llm = bool(os.getenv("OPENAI_API_KEY"))

    if use_llm:
        try:
            return _plan_with_llm(query)
        except Exception:
            # LLM 실패는 치명적이지 않다. 규칙 기반으로 계속 진행한다.
            pass
    return _plan_with_rules(query)


def _plan_with_rules(query: QueryInput) -> Plan:
    task = classify(query.question)
    targets = query.targets or extract_targets(query.question)
    profile = _PROFILES[task]

    return Plan(
        task_type=task,
        target=targets[0] if targets else None,
        targets=targets,
        required_evidence=list(profile["required"]),
        supporting_evidence=list(profile["supporting"]),
        knowledge_requirements=_knowledge_queries(query.question, targets),
        tool_call_order=list(profile["tools"]),
        expected_output_format="소견 판정 + 근거 + 한계",
    )


def _knowledge_queries(question: str, targets: list[str]) -> list[str]:
    """문헌 검색어. 코퍼스가 영문이므로 영문 키워드로 만든다."""
    if targets:
        return [f"{t} chest radiograph diagnostic criteria and management" for t in targets[:2]]
    return [question]


def _plan_with_llm(query: QueryInput) -> Plan:
    """GPT 로 분류한다. 실패 시 예외를 올려 규칙 기반으로 폴백시킨다."""
    from openai import OpenAI

    client = OpenAI()
    resp = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a chest X-ray query planner. Classify the request and "
                    "return one flat JSON object with keys: task_type, targets. "
                    "task_type must be one of: finding_presence, finding_location, "
                    "report_generation, evidence_explanation, clinical_guidance, "
                    "literature_search, temporal_comparison, uncertainty_check. "
                    "targets must be a list of CheXpert observation names "
                    "(e.g. Pneumothorax, Pleural Effusion) or an empty list. "
                    "Do not diagnose. Only decide what evidence is needed."
                ),
            },
            {"role": "user", "content": query.question},
        ],
    )
    raw = json.loads(resp.choices[0].message.content or "{}")
    task = TaskType(raw.get("task_type", "finding_presence"))
    targets = [t for t in raw.get("targets", []) if isinstance(t, str)]
    if not targets:
        targets = extract_targets(query.question)

    profile = _PROFILES[task]
    return Plan(
        task_type=task,
        target=targets[0] if targets else None,
        targets=targets,
        required_evidence=list(profile["required"]),
        supporting_evidence=list(profile["supporting"]),
        knowledge_requirements=_knowledge_queries(query.question, targets),
        tool_call_order=list(profile["tools"]),
        expected_output_format="소견 판정 + 근거 + 한계",
    )
