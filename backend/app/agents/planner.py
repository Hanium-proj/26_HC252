"""Deterministic routing using the existing shared Plan contract."""

from __future__ import annotations

from app.schemas.common import TaskType, ToolName
from app.schemas.query import Plan

_TARGETS = {
    "pneumothorax": ("기흉", "pneumothorax"),
    "pleural_effusion": ("흉수", "effusion"),
    "pneumonia": ("폐렴", "pneumonia"),
    "edema": ("폐부종", "edema"),
    "cardiomegaly": ("심비대", "cardiomegaly"),
    "nodule": ("결절", "nodule"),
}


def plan(case_id: str, query: str, has_image: bool) -> Plan:
    lower = query.lower()
    targets = [key for key, words in _TARGETS.items() if any(w in lower for w in words)]
    task = TaskType.EVIDENCE_EXPLANATION
    if any(w in lower for w in ("비교", "지난", "prior", "compare")):
        task = TaskType.TEMPORAL_COMPARISON
    elif any(w in lower for w in ("문헌", "가이드라인", "literature", "guideline")):
        task = TaskType.LITERATURE_SEARCH
    elif any(w in lower for w in ("판독문", "report")):
        task = TaskType.REPORT_GENERATION
    return Plan(
        task_type=task,
        targets=targets,
        target=targets[0] if targets else None,
        required_evidence=["classifier_prediction", "vqa"] if has_image else ["knowledge"],
        tool_call_order=[ToolName.CLASSIFIER, ToolName.LOCALIZER, ToolName.VQA]
        if has_image
        else [ToolName.KNOWLEDGE],
        expected_output_format="EvidencePacket; research-only uncalibrated outputs",
    )
