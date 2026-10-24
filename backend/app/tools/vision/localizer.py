"""Actual class activation URLs; not anatomical lesion segmentation."""

from __future__ import annotations

from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem
from app.tools.vision.classifier import output


async def localize(image_ref: str, **kwargs) -> list[EvidenceItem]:
    result = await output(image_ref)
    return [
        EvidenceItem(
            source=ToolName.LOCALIZER,
            evidence_type=EvidenceType.MODEL,
            claim="Grad-CAM: " + f["name"],
            confidence=0.0,
            metadata={
                "finding": f["name"],
                "cam_url": f["cam_url"],
                "limitation": "Activation map is not lesion localization",
            },
        )
        for f in result["findings"]
        if f["cam_url"]
    ]
