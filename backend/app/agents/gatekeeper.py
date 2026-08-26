"""[담당 A] Gatekeeper - 파이프라인 진입 전 질문 필터링."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GateResult:
    allowed: bool
    reason: str = ""


def check(query: str, has_image: bool) -> GateResult:
    """질문이 이 시스템이 답할 수 있는 범위인지 판정한다.

    차단 대상:
      - 진단 범위 밖 질문 (처방, 예후 단정, 비의료 질문)
      - 영상 근거가 필요한데 영상이 없는 경우
      - 프롬프트 인젝션 시도
    """
    raise NotImplementedError("담당 A: Gatekeeper 규칙 구현")
