"""CRAG 충분성 판정 파서 테스트.

LLM 호출은 하지 않는다. 판정 문자열을 Sufficiency 로 옮기는 부분이
과거 실제로 결과를 뒤집은 지점이므로 그 로직만 고정한다.
"""

import re

import pytest

from app.retrieval.crag import CragResult, Sufficiency


def parse(raw: str) -> Sufficiency:
    """crag.evaluate 의 판정 파싱과 동일한 규칙."""
    words = set(re.findall(r"[a-z]+", raw.strip().lower()))
    for s in (Sufficiency.INSUFFICIENT, Sufficiency.AMBIGUOUS, Sufficiency.SUFFICIENT):
        if s.value in words:
            return s
    return Sufficiency.AMBIGUOUS


class TestSufficiencyParsing:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("sufficient", Sufficiency.SUFFICIENT),
            ("insufficient", Sufficiency.INSUFFICIENT),
            ("Insufficient.", Sufficiency.INSUFFICIENT),
            ("  AMBIGUOUS  ", Sufficiency.AMBIGUOUS),
            ("The answer is insufficient.", Sufficiency.INSUFFICIENT),
        ],
    )
    def test_parses_verdict(self, raw, expected):
        assert parse(raw) == expected

    def test_insufficient_is_not_read_as_sufficient(self):
        """'sufficient' 는 'insufficient' 의 부분 문자열이다.

        순차 substring 검사를 쓰면 insufficient 응답이 sufficient 로 뒤집히며,
        코퍼스에 없는 주제까지 근거가 있다고 판정하게 된다.
        """
        assert parse("insufficient") is Sufficiency.INSUFFICIENT

    def test_unparseable_defaults_to_ambiguous(self):
        """판정 실패 시 낙관하지 않는다."""
        assert parse("I cannot determine this") is Sufficiency.AMBIGUOUS


class TestCragResult:
    def test_insufficient_blocks_evidence_use(self):
        r = CragResult(hits=[], sufficiency=Sufficiency.INSUFFICIENT)
        assert r.has_evidence is False

    def test_sufficient_with_hits_allows_use(self):
        r = CragResult(hits=[object()], sufficiency=Sufficiency.SUFFICIENT)
        assert r.has_evidence is True

    def test_sufficient_without_hits_blocks_use(self):
        """판정이 좋아도 근거가 비면 사용할 수 없다."""
        r = CragResult(hits=[], sufficiency=Sufficiency.SUFFICIENT)
        assert r.has_evidence is False
