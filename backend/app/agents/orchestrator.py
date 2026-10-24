"""Shared EvidencePacket adapter. Live UI uses the richer /analyze contract."""

from __future__ import annotations

from app.schemas.common import PacketStatus, ToolName, ToolStatus
from app.schemas.evidence import EvidencePacket, ToolResult
from app.schemas.query import Plan, QueryInput
from app.tools.vision import classifier, localizer, quantifier, vqa


async def run(plan: Plan, image_ref: str | None, query: str = "") -> EvidencePacket:
    packet = EvidencePacket(
        query=QueryInput(question=query, image_path=image_ref),
        plan=plan,
        limitations=["Research model outputs are not clinically calibrated."],
    )
    tools = {
        ToolName.CLASSIFIER: classifier.classify,
        ToolName.LOCALIZER: localizer.localize,
        ToolName.VQA: vqa.ask,
        ToolName.QUANTIFIER: quantifier.quantify,
    }
    for tool in plan.tool_call_order:
        try:
            if tool not in tools or image_ref is None:
                packet.tool_results.append(
                    ToolResult(
                        tool_name=tool,
                        status=ToolStatus.SKIPPED,
                        error="Use live retrieval API for literature",
                    )
                )
                packet.status = PacketStatus.PARTIAL
                continue
            packet.items.extend(await tools[tool](image_ref, query=query))
            packet.tool_results.append(ToolResult(tool_name=tool, status=ToolStatus.SUCCESS))
        except Exception as exc:
            packet.tool_results.append(
                ToolResult(tool_name=tool, status=ToolStatus.FAILED, error=type(exc).__name__)
            )
            packet.status = PacketStatus.PARTIAL
    return packet
