"""[담당 B] 충돌 해결 - 파이프라인의 출구.

담당 A 의 EvidencePacket + 담당 B 의 RAG 근거를 합쳐 FinalEvidence 를 만든다.
"""

from __future__ import annotations

from app.schemas.evidence import EvidenceItem, EvidencePacket
from app.schemas.verdict import FinalEvidence


async def resolve(
    packet: EvidencePacket, retrieved: list[EvidenceItem]
) -> FinalEvidence:
    """주장별로 근거를 모아 ACCEPT / CAUTION / NEED_MORE_EVIDENCE 를 판정한다.

    판정 기준 초안 (수치는 검증 후 조정):
      - packet.missing_evidence 에 required 근거가 남아 있으면 NEED_MORE_EVIDENCE
      - 지지 근거 신뢰도 합 >= 0.7 이고 반대 근거가 없으면 ACCEPT
      - 지지와 반대가 모두 유의미하면 Conflict 를 만들고 CAUTION
      - 영상 근거와 문헌 근거가 충돌하면 영상(= 이 환자의 실제 데이터)을 우선한다.
        문헌은 일반론이고 영상은 개별 사실이기 때문.
    """
    raise NotImplementedError("담당 B: Trust & Conflict Resolver 구현")
