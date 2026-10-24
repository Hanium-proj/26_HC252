"""Shared-contract adapter for real local classifier scores."""

from __future__ import annotations

import asyncio

from app.core.storage import get_case
from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem
from app.tools.vision.local_model import infer


async def output(case_id: str) -> dict:
    case = get_case(case_id)
    if not case:
        raise ValueError("업로드된 검사 ID가 필요합니다")
    if case.get("analysis"):
        return case["analysis"]["classifier"]
    return await asyncio.to_thread(infer, case_id)


async def classify(image_ref: str, **kwargs) -> list[EvidenceItem]:
    result = await output(image_ref)
    return [
        EvidenceItem(
            source=ToolName.CLASSIFIER,
            evidence_type=EvidenceType.MODEL,
            claim=f["name"],
            confidence=0.0,
            metadata={
                "finding": f["name"],
                "model_score": f["score"],
                "score_type": "uncalibrated_sigmoid",
                "model": result["model"],
                "limitation": "Calibrated probability is unavailable",
            },
        )
        for f in result["findings"]
    ]
