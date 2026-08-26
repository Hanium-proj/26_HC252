"""[공통] Qwen Synthesis - FinalEvidence 를 자연어 답변으로 변환."""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.schemas.verdict import FinalEvidence


async def synthesize(evidence: FinalEvidence) -> AsyncIterator[str]:
    """FinalEvidence 를 근거 인용이 붙은 한국어 답변으로 스트리밍한다.

    지켜야 할 제약:
      - FinalEvidence 에 없는 사실을 만들어내지 않는다 (환각 차단)
      - verdict 가 CAUTION 이면 불확실성을 문장에 반드시 드러낸다
      - NEED_MORE_EVIDENCE 면 단정하지 않고 무엇이 부족한지 말한다
      - 모든 문헌 주장에 citation 을 붙인다
    """
    raise NotImplementedError("공통: Qwen synthesis 구현")
    yield  # pragma: no cover - AsyncIterator 시그니처 유지용
