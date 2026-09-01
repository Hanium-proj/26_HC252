"""공용 계약이 깨지지 않았는지 확인하는 테스트.

담당 A 파이프라인의 실제 출력을 픽스처로 쓴다. 합의한 형식이 아니라
실제로 넘어오는 형식이 통과해야 계약이 성립한다.
"""

import pytest

from app.schemas import EvidencePacket
from app.schemas.common import EvidenceType, PacketStatus, TaskType, ToolName, ToolStatus

# 담당 A 파이프라인 실행 출력 (2026-09-01 공유본)
AGENT_OUTPUT = {
    "query": {
        "question": "흉수가 있어?",
        "image_path": "C:\\test1.jpg",
        "context": {"targets": ["pleural_effusion"]},
    },
    "plan": {
        "task_type": "finding_presence",
        "target": "pleural_effusion",
        "targets": ["pleural_effusion"],
        "required_evidence": [
            "classifier_prediction",
            "cam_localization",
            "vqa_confirmation",
        ],
        "supporting_evidence": [],
        "optional_evidence": [],
        "knowledge_requirements": [],
        "tool_call_order": ["gatekeeper", "classifier", "localizer", "vqa"],
        "expected_output_format": "Yes / No / Uncertain + supporting evidence",
    },
    "items": [
        {
            "source": "gatekeeper",
            "claim": "{'view': 'AP', 'quality': 0.9}",
            "evidence_type": "model",
            "confidence": 0.9,
            "metadata": {"view": "AP", "quality": 0.9},
        },
        {
            "source": "classifier",
            "claim": "{'finding': 'pleural_effusion', 'probability': 0.82}",
            "evidence_type": "model",
            "confidence": 0.82,
            "metadata": {"finding": "pleural_effusion", "probability": 0.82},
        },
        {
            "source": "localizer",
            "claim": "{'heatmap': 'mock', 'region': 'left_lower_lung'}",
            "evidence_type": "model",
            "confidence": 0.7,
            "metadata": {"heatmap": "mock", "region": "left_lower_lung"},
        },
        {
            "source": "vqa",
            "claim": "{'answer': 'Blunting of the left costophrenic angle'}",
            "evidence_type": "model",
            "confidence": 0.4,
            "metadata": {"answer": "Blunting of the left costophrenic angle"},
        },
    ],
    "tool_results": [
        {"tool_name": "gatekeeper", "status": "success",
         "payload": {"view": "AP", "quality": 0.9}, "confidence": 0.9, "error": None},
        {"tool_name": "classifier", "status": "success",
         "payload": {"finding": "pleural_effusion", "probability": 0.82},
         "confidence": 0.82, "error": None},
        {"tool_name": "localizer", "status": "success",
         "payload": {"heatmap": "mock", "region": "left_lower_lung"},
         "confidence": 0.7, "error": None},
        {"tool_name": "vqa", "status": "success",
         "payload": {"answer": "Blunting of the left costophrenic angle"},
         "confidence": 0.4, "error": None},
    ],
    "limitations": [],
    "status": "complete",
}


@pytest.fixture
def packet() -> EvidencePacket:
    return EvidencePacket.model_validate(AGENT_OUTPUT)


class TestAgentOutputParses:
    def test_agent_output_validates(self, packet):
        """담당 A 의 실제 출력이 스키마를 통과해야 한다."""
        assert packet.status is PacketStatus.COMPLETE
        assert packet.plan.task_type is TaskType.FINDING_PRESENCE
        assert len(packet.items) == 4

    def test_all_eight_task_types_accepted(self):
        for t in (
            "finding_presence", "finding_location", "report_generation",
            "evidence_explanation", "clinical_guidance", "literature_search",
            "temporal_comparison", "uncertainty_check",
        ):
            assert TaskType(t)

    def test_item_fields(self, packet):
        it = packet.items[1]
        assert it.source is ToolName.CLASSIFIER
        assert it.evidence_type is EvidenceType.MODEL
        assert it.confidence == 0.82
        assert it.metadata["finding"] == "pleural_effusion"

    def test_tool_results_recorded(self, packet):
        assert all(r.status is ToolStatus.SUCCESS for r in packet.tool_results)


class TestPacketHelpers:
    def test_by_source(self, packet):
        assert len(packet.by_source(ToolName.CLASSIFIER)) == 1

    def test_no_missing_when_all_tools_succeed(self, packet):
        assert packet.missing_evidence() == []

    def test_failed_tool_produces_missing_evidence(self):
        """도구가 실패하면 required_evidence 가 결손으로 잡혀야 한다.

        Trust 는 이 값으로 NEED_MORE_EVIDENCE 를 판정한다.
        """
        data = {**AGENT_OUTPUT}
        data["items"] = [i for i in AGENT_OUTPUT["items"] if i["source"] != "localizer"]
        data["tool_results"] = [
            {**r, "status": "failed", "error": "CAM 생성 실패"}
            if r["tool_name"] == "localizer" else r
            for r in AGENT_OUTPUT["tool_results"]
        ]
        packet = EvidencePacket.model_validate(data)
        assert ToolName.LOCALIZER in packet.failed_tools()
        assert "cam_localization" in packet.missing_evidence()

    def test_resolved_targets_dedupes(self, packet):
        assert packet.plan.resolved_targets() == ["pleural_effusion"]
