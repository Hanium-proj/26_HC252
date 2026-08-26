"""A/B 공용 기본 타입.

이 패키지(app.schemas)는 담당 A와 담당 B의 유일한 접점이다.
여기 정의된 모델을 바꾸는 변경은 반드시 두 사람이 합의한 뒤 PR 로 진행한다.
"""

from __future__ import annotations

from enum import Enum


class ToolName(str, Enum):
    """Evidence 를 생산할 수 있는 도구 식별자."""

    CLASSIFIER = "classifier"
    LOCALIZER = "localizer"
    VQA = "vqa"
    QUANTIFIER = "quantifier"
    KNOWLEDGE_RAG = "knowledge_rag"
    CASE_RAG = "case_rag"


class EvidenceKind(str, Enum):
    """근거의 출처 성격. Trust 계산에서 가중치 축으로 쓰인다."""

    IMAGE = "image"      # 환자 영상에서 직접 도출된 근거 (A 담당)
    LITERATURE = "literature"  # 외부 문헌 근거 (B 담당)
    CASE = "case"        # 유사 증례 근거 (B 담당)


class Verdict(str, Enum):
    """Trust & Conflict Resolver 의 최종 상태."""

    ACCEPT = "ACCEPT"
    CAUTION = "CAUTION"
    NEED_MORE_EVIDENCE = "NEED_MORE_EVIDENCE"
    REJECT = "REJECT"
