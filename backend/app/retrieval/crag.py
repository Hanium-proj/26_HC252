"""[담당 B] CRAG (Corrective RAG) - Phase 3.

Phase 1-2 의 검색은 한 번 돌고 끝난다. 결과가 부실해도 그대로 다음 단계로 넘어간다.
CRAG 는 그 사이에 자기 평가를 넣는다.

    검색 -> 충분성 평가 -> [부족] 질의 교정 후 재검색 -> [여전히 부족] 근거 부족 선언

핵심은 마지막 분기다. 재검색해도 근거가 없으면 *없다고 말해야* 한다.
빈약한 근거로 답을 만들어내는 것이 환각의 주된 경로다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from openai import OpenAI

from app.core.config import get_settings
from app.retrieval.knowledge_rag.search import SearchHit, hybrid_search


class Sufficiency(str, Enum):
    SUFFICIENT = "sufficient"      # 근거가 충분하다. 그대로 사용
    AMBIGUOUS = "ambiguous"        # 부분적이다. 질의를 바꿔 보강한다
    INSUFFICIENT = "insufficient"  # 관련 근거가 없다


# 리랭커/융합 점수는 스케일이 달라 절대값 비교가 어렵다. 따라서 1차 판정은
# LLM 이 하고, 아래 값은 LLM 호출 전 조기 종료용 최소 조건으로만 쓴다.
MIN_HITS = 1

# 판정 기준을 느슨하게 쓰면 평가자가 거의 모든 결과를 sufficient 로 판정한다.
# 실측에서 당뇨 인슐린 용량, 십자인대 재활 같은 코퍼스 밖 질의에도 sufficient 가
# 나왔다. 검색은 항상 무언가를 반환하고 그 내용이 의학 문헌이므로, 평가자가
# "의학적임"을 "관련 있음"으로 오인하기 때문이다. 이를 명시적으로 차단한다.
_EVAL_SYSTEM = (
    "You are a strict relevance judge for a chest-radiography evidence system.\n"
    "Decide whether the passages contain information that DIRECTLY answers the question.\n\n"
    "Rules:\n"
    "- The passages come from chest imaging guidelines. They will always look medical. "
    "Being medical is NOT relevance.\n"
    "- If the question is about a different organ system, a different disease, or a "
    "non-imaging topic, answer insufficient even if the passages are high quality.\n"
    "- sufficient: passages state the answer to this specific question.\n"
    "- ambiguous: passages touch the topic but do not state the answer.\n"
    "- insufficient: passages are about a different topic.\n\n"
    "Answer with one word only."
)

_REWRITE_SYSTEM = (
    "You rewrite a clinical question to improve literature retrieval from "
    "radiology guidelines and reviews. Use precise radiological terminology and "
    "expand abbreviations. Output only the rewritten query, one line, in English."
)


@dataclass
class CragResult:
    hits: list[SearchHit]
    sufficiency: Sufficiency
    attempts: int = 1
    queries: list[str] = field(default_factory=list)
    notes: str = ""

    @property
    def has_evidence(self) -> bool:
        return self.sufficiency is not Sufficiency.INSUFFICIENT and bool(self.hits)


def _client() -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key)


def evaluate(query: str, hits: list[SearchHit], max_chars: int = 2400) -> Sufficiency:
    """검색 결과가 질문에 답할 만한지 판정한다."""
    if len(hits) < MIN_HITS:
        return Sufficiency.INSUFFICIENT

    budget = max_chars // max(len(hits), 1)
    passages = "\n\n".join(
        f"[{i}] {h.payload['title']}: {h.text[:budget]}"
        for i, h in enumerate(hits, 1)
    )
    resp = _client().chat.completions.create(
        model=get_settings().translate_model,
        messages=[
            {"role": "system", "content": _EVAL_SYSTEM},
            {"role": "user", "content": f"Question: {query}\n\nPassages:\n{passages}"},
        ],
        temperature=0,
    )
    raw = (resp.choices[0].message.content or "").strip().lower()

    # 부분 문자열 매칭 금지: "sufficient" 는 "insufficient" 의 부분 문자열이라
    # 순차 검사하면 insufficient 응답이 sufficient 로 뒤집힌다.
    # 단어 경계로 잘라 정확히 대조한다.
    words = set(re.findall(r"[a-z]+", raw))
    for s in (Sufficiency.INSUFFICIENT, Sufficiency.AMBIGUOUS, Sufficiency.SUFFICIENT):
        if s.value in words:
            return s

    # 판정 실패 시 낙관하지 않는다. 애매한 쪽으로 두고 재검색을 유도한다
    return Sufficiency.AMBIGUOUS


def rewrite(query: str, previous: list[str]) -> str:
    """검색이 실패한 질의를 교정한다."""
    avoid = ""
    if previous:
        avoid = "\n\nThese phrasings already failed, produce a different one:\n" + "\n".join(
            f"- {p}" for p in previous
        )
    resp = _client().chat.completions.create(
        model=get_settings().translate_model,
        messages=[
            {"role": "system", "content": _REWRITE_SYSTEM},
            {"role": "user", "content": query + avoid},
        ],
        temperature=0.3,
    )
    return (resp.choices[0].message.content or query).strip()


def crag_search(
    query: str,
    top_k: int = 8,
    max_attempts: int = 3,
    coverage: list[str] | None = None,
) -> CragResult:
    """충분성 평가와 재검색을 포함한 검색.

    max_attempts 를 두는 이유: 코퍼스에 없는 주제는 질의를 아무리 바꿔도
    나오지 않는다. 무한 재시도 대신 근거 부족을 선언하는 것이 옳다.
    """
    tried: list[str] = []
    q = query
    best: list[SearchHit] = []
    suff = Sufficiency.INSUFFICIENT

    for attempt in range(1, max_attempts + 1):
        hits = hybrid_search(q, top_k=top_k, coverage=coverage)
        tried.append(q)
        suff = evaluate(query, hits)

        # 첫 시도이거나 더 나은 결과면 보관한다. 재검색이 항상 개선되는 것은 아니다
        if attempt == 1 or (suff is Sufficiency.SUFFICIENT and hits):
            best = hits

        if suff is Sufficiency.SUFFICIENT:
            return CragResult(best, suff, attempt, tried, "충분성 확인")
        if attempt == max_attempts:
            break
        q = rewrite(query, tried)

    note = (
        "재검색 후에도 근거 불충분. 답변에서 불확실성을 명시해야 함"
        if suff is Sufficiency.AMBIGUOUS
        else "관련 근거를 찾지 못함. 답변을 생성하지 않아야 함"
    )
    return CragResult(best, suff, len(tried), tried, note)
