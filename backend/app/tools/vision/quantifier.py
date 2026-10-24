"""Quantifies CAM activation fraction only, never physical lesion dimensions."""

from __future__ import annotations

from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem
from app.tools.vision.classifier import output


async def quantify(image_ref: str, **kwargs) -> list[EvidenceItem]:
    result = await output(image_ref)
    return [
        EvidenceItem(
            source=ToolName.QUANTIFIER,
            evidence_type=EvidenceType.MODEL,
            claim="CAM activation fraction: " + f["name"],
            confidence=0.0,
            metadata={
                "finding": f["name"],
                "activation_fraction": f["activation_fraction"],
                "unit": "fraction of model crop",
                "limitation": "Not a physical lesion measurement",
            },
        )
        for f in result["findings"]
        if f["activation_fraction"] is not None
    ]
