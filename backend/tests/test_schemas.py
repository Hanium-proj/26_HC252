"""공용 계약이 깨지지 않았는지 확인하는 테스트.

A/B 어느 쪽이든 schemas 를 건드리면 이 테스트가 먼저 실패해야 한다.
"""

from app.schemas import EvidenceItem, EvidencePacket
from app.schemas.common import EvidenceKind, ToolName


def _item(claim: str, tool: ToolName, result) -> EvidenceItem:
    return EvidenceItem(
        claim=claim,
        tool=tool,
        kind=EvidenceKind.IMAGE,
        result=result,
        confidence=0.82,
        quality=0.91,
    )


def test_evidence_item_matches_agreed_contract():
    """담당자 간 합의한 JSON 형태 그대로 역직렬화되는지."""
    payload = {
        "claim": "pleural_effusion",
        "tool": "classifier",
        "kind": "image",
        "result": True,
        "confidence": 0.82,
        "evidence": {"location": "left_costophrenic_angle"},
        "quality": 0.91,
    }
    item = EvidenceItem.model_validate(payload)
    assert item.claim == "pleural_effusion"
    assert item.tool is ToolName.CLASSIFIER
    assert item.result is True
    assert item.evidence["location"] == "left_costophrenic_angle"


def test_packet_groups_evidence_by_claim():
    """B 의 충돌 탐지가 기대는 by_claim 동작."""
    packet = EvidencePacket(
        case_id="c-1",
        query="흉수 있나요?",
        items=[
            _item("pleural_effusion", ToolName.CLASSIFIER, True),
            _item("pleural_effusion", ToolName.VQA, "left side"),
            _item("pneumothorax", ToolName.CLASSIFIER, False),
        ],
    )
    assert len(packet.by_claim("pleural_effusion")) == 2
    assert packet.claims == ["pleural_effusion", "pneumothorax"]
