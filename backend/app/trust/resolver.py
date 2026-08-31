"""[담당 B] Trust & Conflict Resolver - 파이프라인의 출구.

담당 A 의 EvidencePacket 과 담당 B 의 RAG 근거를 합쳐 FinalEvidence 를 만든다.
"""

from __future__ import annotations

from app.schemas.common import EvidenceType, Verdict
from app.schemas.evidence import EvidenceItem, EvidencePacket
from app.schemas.verdict import ClaimVerdict, Conflict, FinalEvidence
from app.trust.normalize import Normalized, normalize
from app.trust.scoring import score

# 판정 임계값. 검증셋 확보 전까지는 임의값이며 캘리브레이션 대상이다.
ACCEPT_THRESHOLD = 0.35
REJECT_THRESHOLD = 0.35
# 반대 근거가 지지 근거의 이 비율을 넘으면 충돌로 본다
CONFLICT_RATIO = 0.5


def _total(ns: list[Normalized]) -> float:
    return sum(score(n) for n in ns)


def resolve_claim(
    claim: str, group: list[Normalized], missing: bool
) -> ClaimVerdict:
    """주장 하나를 판정한다."""
    pro = [n for n in group if n.verdict is True]
    con = [n for n in group if n.verdict is False]
    neutral = [n for n in group if n.verdict is None]
    s_pro, s_con = _total(pro), _total(con)

    conflict = None
    if pro and con and min(s_pro, s_con) >= CONFLICT_RATIO * max(s_pro, s_con):
        # 영상 근거는 이 환자의 개별 사실이므로 일반론인 문헌보다 우선한다
        img_pro = [n for n in pro if n.item.evidence_type is EvidenceType.MODEL]
        img_con = [n for n in con if n.item.evidence_type is EvidenceType.MODEL]
        resolved = None
        if img_pro and not img_con:
            resolved = True
        elif img_con and not img_pro:
            resolved = False
        conflict = Conflict(
            claim=claim,
            items=[n.item for n in pro + con],
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
    elif not group:
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
        rationale = f"근거 신뢰도가 임계값 미달 (지지 {s_pro:.3f}, 반대 {s_con:.3f})"

    if neutral:
        rationale += f". 판정불가 근거 {len(neutral)}건은 맥락으로만 사용"

    return ClaimVerdict(
        claim=claim,
        verdict=verdict,
        trust_score=round(min(max(s_pro, 0.0), 1.0), 4),
        supporting=[n.item for n in pro],
        opposing=[n.item for n in con],
        conflict=conflict,
        rationale=rationale,
    )


def _overall(verdicts: list[ClaimVerdict]) -> Verdict:
    """케이스 전체 상태. 가장 보수적인 판정을 따른다."""
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
    packet: EvidencePacket, retrieved: list[EvidenceItem] | None = None
) -> FinalEvidence:
    """주장별로 근거를 모아 최종 판정을 만든다."""
    normalized = normalize(packet, retrieved)

    groups: dict[str, list[Normalized]] = {}
    for n in normalized:
        groups.setdefault(n.claim_key, []).append(n)

    # 검증 대상이 특정되지 않은 근거는 별도 주장으로 세우지 않는다.
    # 'unknown' 에 대해 ACCEPT 가 나오면 존재하지 않는 소견을 승인하게 된다.
    unusable = [k for k, g in groups.items() if not any(n.usable for n in g)]
    for k in unusable:
        groups.pop(k)

    missing = bool(packet.missing_evidence())
    verdicts = [
        resolve_claim(claim, group, missing=missing)
        for claim, group in groups.items()
    ]

    citations = [
        {"claim": n.claim_key, **n.item.metadata}
        for n in normalized
        if n.item.evidence_type is EvidenceType.LITERATURE and n.item.metadata
    ]

    limitations = list(packet.limitations)
    if unusable:
        limitations.append(
            f"검증 대상이 특정되지 않아 제외한 근거 {len(unusable)}건: {unusable}"
        )

    return FinalEvidence(
        query=packet.query.question,
        task_type=packet.plan.task_type,
        verdicts=verdicts,
        citations=citations,
        limitations=limitations,
        overall=_overall(verdicts) if verdicts else Verdict.NEED_MORE_EVIDENCE,
    )
