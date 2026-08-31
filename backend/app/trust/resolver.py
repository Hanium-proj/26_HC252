"""[담당 B] Trust & Conflict Resolver - 파이프라인의 출구.

담당 A 의 EvidencePacket 과 담당 B 의 RAG 근거를 합쳐 FinalEvidence 를 만든다.
"""

from __future__ import annotations

from app.schemas.common import EvidenceKind, Verdict
from app.schemas.evidence import EvidenceItem, EvidencePacket
from app.schemas.verdict import ClaimVerdict, Conflict, FinalEvidence
from app.trust.scoring import is_positive, score

# 판정 임계값. 검증셋 확보 전까지는 임의값이며 캘리브레이션 대상이다.
ACCEPT_THRESHOLD = 0.35
REJECT_THRESHOLD = 0.35
# 반대 근거가 지지 근거의 이 비율을 넘으면 충돌로 본다
CONFLICT_RATIO = 0.5


def _split(items: list[EvidenceItem]) -> tuple[list, list, list]:
    """근거를 지지 / 반대 / 판정불가로 나눈다."""
    pro, con, neutral = [], [], []
    for it in items:
        p = is_positive(it)
        (pro if p is True else con if p is False else neutral).append(it)
    return pro, con, neutral


def _total(items: list[EvidenceItem]) -> float:
    return sum(score(it) for it in items)


def resolve_claim(claim: str, items: list[EvidenceItem], missing: bool) -> ClaimVerdict:
    """주장 하나를 판정한다."""
    pro, con, neutral = _split(items)
    s_pro, s_con = _total(pro), _total(con)

    conflict = None
    if pro and con and min(s_pro, s_con) >= CONFLICT_RATIO * max(s_pro, s_con):
        # 영상 근거는 이 환자의 개별 사실이므로 일반론인 문헌보다 우선한다
        img_pro = [i for i in pro if i.kind is EvidenceKind.IMAGE]
        img_con = [i for i in con if i.kind is EvidenceKind.IMAGE]
        resolved = None
        if img_pro and not img_con:
            resolved = True
        elif img_con and not img_pro:
            resolved = False
        conflict = Conflict(
            claim=claim,
            items=pro + con,
            description=(
                f"지지 {len(pro)}건(신뢰도 {s_pro:.3f}) 대 "
                f"반대 {len(con)}건(신뢰도 {s_con:.3f})"
            ),
            resolved_to=resolved,
        )

    # 판정 순서가 중요하다. 필수 근거 결손은 다른 조건보다 우선한다.
    # 근거가 없어서 못 정하는 것과 근거를 보고 아니라고 판단한 것은 다르다.
    if missing:
        verdict = Verdict.NEED_MORE_EVIDENCE
        rationale = "Planner 가 요구한 근거를 수집하지 못함"
    elif not items:
        verdict = Verdict.NEED_MORE_EVIDENCE
        rationale = "해당 주장에 대한 근거 없음"
    elif conflict is not None:
        verdict = Verdict.CAUTION
        rationale = (
            f"근거 충돌. {conflict.description}"
            + (
                f". 영상 근거를 우선하여 {conflict.resolved_to} 로 해석"
                if conflict.resolved_to is not None
                else ". 영상 근거만으로 해소되지 않음"
            )
        )
    elif s_pro >= ACCEPT_THRESHOLD and s_pro > s_con:
        verdict = Verdict.ACCEPT
        rationale = f"지지 근거 신뢰도 {s_pro:.3f} 이 임계값 {ACCEPT_THRESHOLD} 이상"
    elif s_con >= REJECT_THRESHOLD and s_con > s_pro:
        verdict = Verdict.REJECT
        rationale = f"반대 근거 신뢰도 {s_con:.3f} 이 우세"
    else:
        verdict = Verdict.NEED_MORE_EVIDENCE
        rationale = (
            f"근거 신뢰도가 임계값 미달 (지지 {s_pro:.3f}, 반대 {s_con:.3f})"
        )

    return ClaimVerdict(
        claim=claim,
        verdict=verdict,
        trust_score=round(min(max(s_pro, 0.0), 1.0), 4),
        supporting=pro,
        opposing=con,
        conflict=conflict,
        rationale=rationale + (f". 판정불가 근거 {len(neutral)}건 제외" if neutral else ""),
    )


def _overall(verdicts: list[ClaimVerdict]) -> Verdict:
    """케이스 전체 상태. 가장 보수적인 판정을 따른다.

    주장 하나라도 근거가 부족하면 케이스 전체를 확정할 수 없다.
    """
    if not verdicts:
        return Verdict.NEED_MORE_EVIDENCE
    order = [
        Verdict.NEED_MORE_EVIDENCE,
        Verdict.CAUTION,
        Verdict.REJECT,
        Verdict.ACCEPT,
    ]
    return min((v.verdict for v in verdicts), key=order.index)


async def resolve(
    packet: EvidencePacket, retrieved: list[EvidenceItem]
) -> FinalEvidence:
    """주장별로 근거를 모아 최종 판정을 만든다."""
    by_claim: dict[str, list[EvidenceItem]] = {}
    for it in list(packet.items) + list(retrieved):
        by_claim.setdefault(it.claim, []).append(it)

    missing = set(packet.missing_evidence)
    verdicts = [
        resolve_claim(claim, items, missing=claim in missing)
        for claim, items in by_claim.items()
    ]

    citations = [
        {"claim": it.claim, **it.evidence}
        for it in retrieved
        if it.kind is EvidenceKind.LITERATURE and it.evidence
    ]

    return FinalEvidence(
        case_id=packet.case_id,
        query=packet.query,
        verdicts=verdicts,
        citations=citations,
        overall=_overall(verdicts),
    )
