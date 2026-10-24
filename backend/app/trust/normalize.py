"""[담당 B] 정규화 - EvidenceItem 에서 Trust 계산 입력을 도출한다.

담당 A 의 EvidenceItem 은 도구 출력을 그대로 담는다. Trust 계산에는 세 가지가
더 필요한데, 모두 metadata 에서 도출할 수 있으므로 담당 A 가 별도 필드를
만들 필요는 없다.

  검증 대상(claim_key) - 어느 소견에 대한 근거인가. 근거를 묶는 조인 키
  판정(verdict)        - 소견이 있다는 쪽인가 없다는 쪽인가
  입력 품질(quality)    - 이 근거를 얼마나 믿을 수 있는 입력에서 얻었는가

claim 문자열을 파싱하지 않는 이유: 도구마다 형식이 다르고 dict 를 문자열화한
것이라 안정적으로 되돌릴 수 없다. 구조화된 metadata 만 사용한다.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.common import EvidenceType, ToolName
from app.schemas.evidence import EvidenceItem, EvidencePacket

# classifier 확률을 양성으로 볼 임계값
POSITIVE_THRESHOLD = 0.5

# gatekeeper 가 품질을 보고하지 않은 경우의 기본값.
# 1.0 으로 두면 품질 미상을 완벽한 영상과 동일하게 취급하게 되므로 낮춰 잡는다.
DEFAULT_QUALITY = 0.6

# 소견을 특정하지 못한 상태를 나타내는 값들. 이런 근거는 Trust 계산에서 제외한다.
UNKNOWN_TARGETS = {"unknown", "none", "null", "", "n/a"}

# 같은 소견이 표기만 달리 들어온다. 영상 도구는 snake_case 를,
# CheXpert 라벨 체계는 Title Case 를 쓴다. 정규화하지 않으면 같은 소견의
# 근거가 서로 다른 주장으로 갈려 충돌 탐지도 집계도 성립하지 않는다.
#   pleural_effusion  <-  "Pleural Effusion" / "pleural effusion"
_CANONICAL_ALIASES = {
    "effusion": "pleural_effusion",
    "ptx": "pneumothorax",
    "cardiomegaly ": "cardiomegaly",
}


def canonical_claim(name: str) -> str:
    """소견 표기를 하나의 형태로 통일한다."""
    key = "_".join(name.strip().lower().split())
    key = key.replace("-", "_")
    return _CANONICAL_ALIASES.get(key, key)


@dataclass
class Normalized:
    """Trust 계산에 쓰이는 정규화된 근거."""

    item: EvidenceItem
    claim_key: str          # 어느 소견에 대한 근거인가
    verdict: bool | None    # True 지지 / False 반대 / None 판정불가
    quality: float

    @property
    def usable(self) -> bool:
        """검증 대상이 특정되지 않은 근거는 사용할 수 없다."""
        return self.claim_key.strip().lower() not in UNKNOWN_TARGETS


def packet_quality(packet: EvidencePacket) -> float:
    """영상 입력 품질. gatekeeper 가 측정해 모든 영상 근거에 적용된다.

    품질은 개별 도구가 아니라 입력 영상의 속성이므로 packet 단위로 잡는다.
    자세가 틀어진 영상에서는 classifier 도 localizer 도 같이 불리하다.
    """
    for it in packet.items:
        if it.source is ToolName.GATEKEEPER:
            q = it.metadata.get("quality")
            if isinstance(q, int | float):
                return max(0.0, min(1.0, float(q)))
    for r in packet.tool_results:
        if r.tool_name is ToolName.GATEKEEPER:
            q = r.payload.get("quality")
            if isinstance(q, int | float):
                return max(0.0, min(1.0, float(q)))
    return DEFAULT_QUALITY


def _claim_key(item: EvidenceItem, fallback: str) -> str:
    """이 근거가 어느 소견에 대한 것인지 도출한다."""
    md = item.metadata
    for field in ("finding", "claim", "observation", "target", "label"):
        v = md.get(field)
        if isinstance(v, str) and v.strip():
            return canonical_claim(v)
    return canonical_claim(fallback)


def _verdict(item: EvidenceItem) -> bool | None:
    """소견 존재 여부 판정.

    도구마다 출력이 달라 규칙을 분리한다. 판정할 수 없으면 None 을 돌려
    지지/반대 어느 쪽으로도 세지 않는다. 억지로 한쪽에 넣으면 없는 근거를
    만들어내는 것과 같다.
    """
    md = item.metadata
    src = item.source

    if src is ToolName.CLASSIFIER:
        p = md.get("probability", md.get("prob"))
        if isinstance(p, int | float):
            return float(p) >= POSITIVE_THRESHOLD
        return None

    if src is ToolName.LOCALIZER:
        if md.get("proxy_pass") is False or md.get("region") == "outside_lung_field":
            return None
        # 위치를 짚었다는 것 자체가 소견 존재의 근거다
        region = md.get("region") or md.get("location")
        return bool(region) if region is not None else None

    if src is ToolName.QUANTIFIER:
        v = md.get("value", md.get("measurement"))
        return float(v) > 0 if isinstance(v, int | float) else None

    if src is ToolName.CASE:
        ratio = md.get("agreement_ratio")
        if isinstance(ratio, int | float):
            return float(ratio) >= POSITIVE_THRESHOLD
        return None

    # VQA 자유서술과 문헌 근거는 지지/반대로 환원할 수 없다.
    # 맥락 정보이지 소견 판정이 아니다.
    return None


def normalize_item(
    item: EvidenceItem, fallback_claim: str, quality: float
) -> Normalized:
    # 문헌/증례 근거는 영상 품질과 무관하므로 자체 품질을 우선한다
    if item.evidence_type is not EvidenceType.MODEL:
        own = item.metadata.get("quality")
        if isinstance(own, int | float):
            quality = max(0.0, min(1.0, float(own)))

    return Normalized(
        item=item,
        claim_key=_claim_key(item, fallback_claim),
        verdict=_verdict(item),
        quality=quality,
    )


def normalize(
    packet: EvidencePacket, extra: list[EvidenceItem] | None = None
) -> list[Normalized]:
    """packet 과 RAG 근거를 Trust 계산용으로 정규화한다.

    gatekeeper 는 제외한다. 영상 품질 측정기이지 소견 근거 생산자가 아니며,
    이미 packet_quality 로 반영되었다.
    """
    quality = packet_quality(packet)
    targets = packet.plan.resolved_targets()
    fallback = targets[0] if targets else "unspecified"

    out = [
        normalize_item(it, fallback, quality)
        for it in packet.items
        if it.source is not ToolName.GATEKEEPER
    ]
    out += [normalize_item(it, fallback, quality) for it in (extra or [])]
    return out
