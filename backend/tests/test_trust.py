"""Trust & Conflict Resolver 테스트."""

import pytest

from app.schemas.common import EvidenceKind, ToolName, Verdict
from app.schemas.evidence import EvidenceItem, EvidencePacket
from app.trust.resolver import resolve, resolve_claim
from app.trust.scoring import QUALITY_FLOOR, is_positive, score


def item(tool=ToolName.CLASSIFIER, kind=EvidenceKind.IMAGE, result=True,
         conf=0.9, qual=0.9, claim="pleural_effusion") -> EvidenceItem:
    return EvidenceItem(
        claim=claim, tool=tool, kind=kind, result=result,
        confidence=conf, quality=qual,
    )


class TestScoring:
    def test_in_unit_range(self):
        assert 0.0 <= score(item()) <= 1.0

    def test_classifier_outranks_vqa_at_equal_confidence(self):
        assert score(item(tool=ToolName.CLASSIFIER)) > score(item(tool=ToolName.VQA))

    def test_image_outranks_literature_at_equal_confidence(self):
        img = item(kind=EvidenceKind.IMAGE, tool=ToolName.KNOWLEDGE_RAG)
        lit = item(kind=EvidenceKind.LITERATURE, tool=ToolName.KNOWLEDGE_RAG)
        assert score(img) > score(lit)

    def test_quality_floor_zeroes_out_high_confidence(self):
        """모델이 확신해도 입력이 나쁘면 근거로 쓸 수 없다."""
        assert score(item(conf=0.99, qual=QUALITY_FLOOR - 0.01)) == 0.0

    def test_low_quality_lowers_score(self):
        assert score(item(qual=0.9)) > score(item(qual=0.4))


class TestIsPositive:
    def test_bool_passthrough(self):
        assert is_positive(item(result=True)) is True
        assert is_positive(item(result=False)) is False

    def test_float_positive_means_present(self):
        assert is_positive(item(result=2.5)) is True
        assert is_positive(item(result=0.0)) is False

    def test_text_is_undecidable(self):
        """VQA 자유서술은 지지/반대로 셀 수 없다."""
        assert is_positive(item(result="left costophrenic blunting")) is None


class TestResolveClaim:
    def test_accept_on_strong_support(self):
        v = resolve_claim(
            "pleural_effusion",
            [item(), item(tool=ToolName.QUANTIFIER, result=1.2)],
            missing=False,
        )
        assert v.verdict is Verdict.ACCEPT

    def test_missing_evidence_wins_over_everything(self):
        """근거가 없어 못 정하는 것과 아니라고 판단한 것은 다르다."""
        v = resolve_claim("pleural_effusion", [item()], missing=True)
        assert v.verdict is Verdict.NEED_MORE_EVIDENCE

    def test_no_evidence_is_need_more(self):
        v = resolve_claim("pneumothorax", [], missing=False)
        assert v.verdict is Verdict.NEED_MORE_EVIDENCE

    def test_conflict_produces_caution(self):
        v = resolve_claim(
            "pleural_effusion",
            [item(result=True), item(tool=ToolName.CLASSIFIER, result=False)],
            missing=False,
        )
        assert v.verdict is Verdict.CAUTION
        assert v.conflict is not None

    def test_image_evidence_breaks_tie_against_literature(self):
        """문헌은 일반론이고 영상은 이 환자의 사실이다."""
        v = resolve_claim(
            "pleural_effusion",
            [
                item(kind=EvidenceKind.IMAGE, result=True),
                item(
                    kind=EvidenceKind.LITERATURE,
                    tool=ToolName.KNOWLEDGE_RAG,
                    result=False,
                ),
            ],
            missing=False,
        )
        assert v.conflict is not None
        assert v.conflict.resolved_to is True

    def test_weak_opposition_does_not_create_conflict(self):
        """반대 근거가 현저히 약하면 충돌이 아니라 단순 우세다.

        Case RAG 근거(0.29)는 classifier 영상 근거(0.73) 대비 절반에 못 미쳐
        판단을 흔들 무게가 없다.
        """
        v = resolve_claim(
            "pleural_effusion",
            [
                item(kind=EvidenceKind.IMAGE, result=True),
                item(kind=EvidenceKind.CASE, tool=ToolName.CASE_RAG, result=False),
            ],
            missing=False,
        )
        assert v.conflict is None
        assert v.verdict is Verdict.ACCEPT

    def test_weak_evidence_is_need_more_not_accept(self):
        v = resolve_claim(
            "pneumonia",
            [item(tool=ToolName.VQA, result=True, conf=0.2, qual=0.4)],
            missing=False,
        )
        assert v.verdict is Verdict.NEED_MORE_EVIDENCE

    def test_reject_on_strong_opposition(self):
        v = resolve_claim(
            "pneumothorax",
            [item(result=False), item(tool=ToolName.QUANTIFIER, result=0.0)],
            missing=False,
        )
        assert v.verdict is Verdict.REJECT


class TestResolve:
    @pytest.mark.asyncio
    async def test_overall_takes_most_conservative(self):
        """주장 하나라도 근거가 부족하면 케이스를 확정할 수 없다."""
        packet = EvidencePacket(
            case_id="c-1", query="흉수 있나요?",
            items=[item(claim="pleural_effusion"), item(claim="pneumothorax", result=True)],
            missing_evidence=["pneumothorax"],
        )
        final = await resolve(packet, [])
        assert final.overall is Verdict.NEED_MORE_EVIDENCE

    @pytest.mark.asyncio
    async def test_literature_evidence_becomes_citation(self):
        packet = EvidencePacket(case_id="c-1", query="q", items=[item()])
        lit = EvidenceItem(
            claim="pleural_effusion", tool=ToolName.KNOWLEDGE_RAG,
            kind=EvidenceKind.LITERATURE, result="transudate vs exudate",
            confidence=0.7, quality=0.9, evidence={"doc_id": "GL004", "page": 12},
        )
        final = await resolve(packet, [lit])
        assert final.citations and final.citations[0]["doc_id"] == "GL004"
