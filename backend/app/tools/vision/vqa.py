"""Structured real OpenAI image interpretation adapter."""

from __future__ import annotations

from app.agents.live import describe
from app.core.storage import get_case
from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem


async def ask(image_ref: str, **kwargs) -> list[EvidenceItem]:
    case = get_case(image_ref)
    if not case:
        raise ValueError("업로드된 검사 ID가 필요합니다")
    report = await describe(
        case, kwargs.get("query", "관찰 가능한 흉부 영상 소견을 설명해 주세요.")
    )
    return [
        EvidenceItem(
            source=ToolName.VQA,
            evidence_type=EvidenceType.MODEL,
            claim=o["description"],
            confidence=0.0,
            metadata={
                "finding": o["finding"],
                "answer": o["description"],
                "certainty": o["certainty"],
                "location": o["location"],
            },
        )
        for o in report["observations"]
    ]
