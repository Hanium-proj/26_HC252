"""Input gate; evidence availability is also enforced by the actual tool layer."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GateResult:
    allowed: bool
    reason: str = ""


def check(query: str, has_image: bool) -> GateResult:
    if not 2 <= len(query.strip()) <= 6000:
        return GateResult(False, "질문은 2~6000자여야 합니다")
    if any(x in query.lower() for x in ("ignore previous instructions", "reveal api key")):
        return GateResult(False, "시스템 지시 변경이나 비밀 정보 요청은 처리하지 않습니다")
    if not has_image and any(x in query for x in ("이 영상", "이 사진", "이 엑스레이")):
        return GateResult(False, "질문에 필요한 영상이 없습니다")
    return GateResult(True)
