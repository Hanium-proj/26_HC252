"""Trust & Conflict Resolver 테스트.

담당 A 의 EvidencePacket 형식을 그대로 입력으로 쓴다.
"""

import pytest

from app.schemas.common import (
    EvidenceType,
    PacketStatus,
    TaskType,
    ToolName,
    ToolStatus,
    Verdict,
)
from app.schemas.evidence import EvidenceItem, EvidencePacket, ToolResult
from app.schemas.query import Plan, QueryInput
from app.trust.normalize import DEFAULT_QUALITY, normalize, packet_quality
from app.trust.resolver import resolve, resolve_claim
from app.trust.scoring import QUALITY_FLOOR, score

CLAIM = "pleural_effusion"


def gate(quality=0.9) -> EvidenceItem:
    return EvidenceItem(
        source=ToolName.GATEKEEPER, claim=f"{{'quality': {quality}}}",
        evidence_type=EvidenceType.MODEL, confidence=0.9,
        metadata={"view": "AP", "quality": quality},
    )


def clf(prob=0.82, finding=CLAIM) -> EvidenceItem:
    return EvidenceItem(
        source=ToolName.CLASSIFIER, claim=f"{{'finding': '{finding}'}}",
        evidence_type=EvidenceType.MODEL, confidence=prob,
        metadata={"finding": finding, "probability": prob},
    )


def loc(region="left_lower_lung", finding=CLAIM) -> EvidenceItem:
    return EvidenceItem(
        source=ToolName.LOCALIZER, claim=f"{{'region': '{region}'}}",
        evidence_type=EvidenceType.MODEL, confidence=0.7,
        metadata={"finding": finding, "region": region},
    )


def vqa(answer="blunting seen") -> EvidenceItem:
    return EvidenceItem(
        source=ToolName.VQA, claim=f"{{'answer': '{answer}'}}",
        evidence_type=EvidenceType.MODEL, confidence=0.4,
        metadata={"finding": CLAIM, "answer": answer},
    )


def case(ratio=0.8) -> EvidenceItem:
    return EvidenceItem(
        source=ToolName.CASE, claim=f"유사 사례 중 {ratio}",
        evidence_type=EvidenceType.CASE, confidence=0.6,
        metadata={"finding": CLAIM, "agreement_ratio": ratio, "quality": 0.5},
    )


def lit() -> EvidenceItem:
    return EvidenceItem(
        source=ToolName.KNOWLEDGE, claim="Transudate versus exudate...",
        evidence_type=EvidenceType.LITERATURE, confidence=0.7,
        metadata={"finding": CLAIM, "quality": 0.9, "doc_id": "GL004", "page": 12},
    )


def packet(items, required=None, failed=None, targets=(CLAIM,)) -> EvidencePacket:
    results = [
        ToolResult(tool_name=i.source, status=ToolStatus.SUCCESS, confidence=i.confidence)
        for i in items
    ]
    for t in failed or []:
        results.append(ToolResult(tool_name=t, status=ToolStatus.FAILED, error="mock"))
    return EvidencePacket(
        query=QueryInput(question="흉수가 있어?", context={"targets": list(targets)}),
        plan=Plan(
            task_type=TaskType.FINDING_PRESENCE,
            target=targets[0] if targets else None,
            targets=list(targets),
            required_evidence=list(required or []),
            tool_call_order=[i.source for i in items],
        ),
        items=items,
        tool_results=results,
        status=PacketStatus.COMPLETE,
    )


def norm(items, **kw):
    return normalize(packet(items, **kw))


class TestPacketQuality:
    def test_gatekeeper_quality_applies_to_all_items(self):
        """품질은 개별 도구가 아니라 입력 영상의 속성이다."""
        ns = norm([gate(0.4), clf(), loc()])
        assert all(n.quality == 0.4 for n in ns)

    def test_default_when_no_gatekeeper(self):
        """품질 미상을 완벽한 영상과 동일하게 취급하지 않는다."""
        assert packet_quality(packet([clf()])) == DEFAULT_QUALITY

    def test_gatekeeper_excluded_from_evidence(self):
        """gatekeeper 는 품질 측정기이지 소견 근거가 아니다."""
        ns = norm([gate(), clf()])
        assert all(n.item.source is not ToolName.GATEKEEPER for n in ns)

    def test_literature_uses_own_quality(self):
        ns = normalize(packet([gate(0.3), clf()]), [lit()])
        lit_n = next(n for n in ns if n.item.source is ToolName.KNOWLEDGE)
        assert lit_n.quality == 0.9


class TestClaimCanonicalization:
    def test_chexpert_label_matches_snake_case(self):
        """영상 도구는 snake_case, CheXpert 라벨은 Title Case 를 쓴다.

        정규화하지 않으면 같은 소견의 근거가 서로 다른 주장으로 갈려
        집계도 충돌 탐지도 성립하지 않는다.
        """
        from app.trust.normalize import canonical_claim

        assert canonical_claim("Pleural Effusion") == "pleural_effusion"
        assert canonical_claim("pleural_effusion") == "pleural_effusion"
        assert canonical_claim("Enlarged Cardiomediastinum") == "enlarged_cardiomediastinum"

    def test_case_and_model_evidence_group_together(self):
        case_item = EvidenceItem(
            source=ToolName.CASE, claim="유사 사례",
            evidence_type=EvidenceType.CASE, confidence=0.6,
            metadata={"finding": "Pleural Effusion", "agreement_ratio": 0.8},
        )
        ns = normalize(packet([gate(), clf()]), [case_item])
        assert len({n.claim_key for n in ns}) == 1


class TestVerdictDerivation:
    def test_classifier_probability_threshold(self):
        assert norm([gate(), clf(0.82)])[0].verdict is True
        assert norm([gate(), clf(0.2)])[0].verdict is False

    def test_localizer_region_means_present(self):
        assert norm([gate(), loc()])[0].verdict is True

    def test_vqa_text_is_undecidable(self):
        """자유서술은 지지/반대로 환원되지 않는다."""
        assert norm([gate(), vqa()])[0].verdict is None

    def test_case_uses_agreement_ratio(self):
        ns = normalize(packet([gate()]), [case(0.8)])
        assert ns[0].verdict is True
        ns = normalize(packet([gate()]), [case(0.2)])
        assert ns[0].verdict is False

    def test_claim_key_from_metadata_finding(self):
        assert norm([gate(), clf()])[0].claim_key == CLAIM

    def test_claim_key_falls_back_to_plan_target(self):
        it = EvidenceItem(
            source=ToolName.VQA, claim="x", evidence_type=EvidenceType.MODEL,
            confidence=0.5, metadata={"answer": "yes"},
        )
        assert norm([gate(), it])[0].claim_key == CLAIM


class TestScoring:
    def test_in_unit_range(self):
        assert 0.0 <= score(norm([gate(), clf()])[0]) <= 1.0

    def test_classifier_outranks_vqa(self):
        ns = norm([gate(), clf(0.6), vqa()])
        by = {n.item.source: score(n) for n in ns}
        assert by[ToolName.CLASSIFIER] > by[ToolName.VQA]

    def test_model_outranks_literature(self):
        ns = normalize(packet([gate(), clf(0.7)]), [lit()])
        by = {n.item.source: score(n) for n in ns}
        assert by[ToolName.CLASSIFIER] > by[ToolName.KNOWLEDGE]

    def test_quality_floor_zeroes_confident_reading(self):
        """모델이 확신해도 판독 불가능한 영상이면 근거가 될 수 없다."""
        ns = norm([gate(QUALITY_FLOOR - 0.05), clf(0.99)])
        assert score(ns[0]) == 0.0

    def test_unspecified_target_scores_zero(self):
        """무엇에 대한 근거인지 모르는 것은 근거가 아니다."""
        ns = norm([gate(), clf(finding="unknown")], targets=("unknown",))
        assert score(ns[0]) == 0.0


class TestResolveClaim:
    def test_accept_on_strong_support(self):
        ns = norm([gate(), clf(0.82), loc()])
        v = resolve_claim(CLAIM, ns, missing=False)
        assert v.verdict is Verdict.ACCEPT

    def test_missing_evidence_outranks_everything(self):
        """근거가 없어 못 정하는 것과 아니라고 판단한 것은 다르다."""
        ns = norm([gate(), clf(0.9)])
        assert resolve_claim(CLAIM, ns, missing=True).verdict is Verdict.NEED_MORE_EVIDENCE

    def test_no_evidence_is_need_more(self):
        assert resolve_claim(CLAIM, [], missing=False).verdict is Verdict.NEED_MORE_EVIDENCE

    def test_conflict_produces_caution(self):
        ns = norm([gate(), clf(0.9), loc()])
        ns[0].verdict = False  # classifier 를 반대로 뒤집어 충돌 구성
        v = resolve_claim(CLAIM, ns, missing=False)
        assert v.verdict is Verdict.CAUTION
        assert v.conflict is not None

    def test_model_evidence_breaks_tie_over_literature(self):
        """문헌은 일반론이고 영상은 이 환자의 사실이다."""
        ns = normalize(packet([gate(), clf(0.82)]), [lit()])
        ns[-1].verdict = False
        v = resolve_claim(CLAIM, ns, missing=False)
        assert v.conflict is not None
        assert v.conflict.resolved_to is True

    def test_vqa_only_is_need_more_not_accept(self):
        """맥락 정보만으로는 판정할 수 없다."""
        ns = norm([gate(), vqa()])
        assert resolve_claim(CLAIM, ns, missing=False).verdict is Verdict.NEED_MORE_EVIDENCE


class TestResolve:
    @pytest.mark.asyncio
    async def test_unknown_target_is_not_accepted(self):
        """실제 로그에서 관측된 회귀.

        Planner 가 target 을 특정하지 못해 finding 이 'unknown' 인데도
        확률 0.82 가 붙어 나왔다. 이 상태로 ACCEPT 가 나오면 존재하지 않는
        소견을 승인하게 된다.
        """
        p = packet([gate(), clf(0.82, finding="unknown")], targets=("unknown",))
        final = await resolve(p)
        assert all(v.verdict is not Verdict.ACCEPT for v in final.verdicts)
        assert final.overall is Verdict.NEED_MORE_EVIDENCE
        assert any("특정되지 않아" in x for x in final.limitations)

    @pytest.mark.asyncio
    async def test_failed_tool_forces_need_more_evidence(self):
        p = packet(
            [gate(), clf(0.9)],
            required=["classifier_prediction", "cam_localization"],
            failed=[ToolName.LOCALIZER],
        )
        final = await resolve(p)
        assert final.overall is Verdict.NEED_MORE_EVIDENCE

    @pytest.mark.asyncio
    async def test_literature_becomes_citation(self):
        final = await resolve(packet([gate(), clf()]), [lit()])
        assert final.citations and final.citations[0]["doc_id"] == "GL004"

    @pytest.mark.asyncio
    async def test_overall_takes_most_conservative(self):
        p = packet(
            [gate(), clf(0.9, finding="pneumothorax"), clf(0.82)],
            targets=("pleural_effusion", "pneumothorax"),
            required=["classifier_prediction", "vqa_confirmation"],
            failed=[ToolName.VQA],
        )
        final = await resolve(p)
        assert final.overall is Verdict.NEED_MORE_EVIDENCE

    @pytest.mark.asyncio
    async def test_task_type_carried_through(self):
        final = await resolve(packet([gate(), clf()]))
        assert final.task_type is TaskType.FINDING_PRESENCE
