"""A/B 공용 기본 타입.

이 패키지(app.schemas)는 담당 A와 담당 B의 유일한 접점이다.
필드명과 구조는 담당 A의 Agent 파이프라인 출력 형식을 기준으로 한다.
변경은 반드시 두 사람이 합의한 뒤 PR 로 진행한다.
"""

from __future__ import annotations

from enum import Enum


class TaskType(str, Enum):
    """질문 유형. Planner 가 분류하며 필요한 근거와 도구 순서를 결정한다."""

    FINDING_PRESENCE = "finding_presence"          # "흉수가 있어?"
    FINDING_LOCATION = "finding_location"          # "폐렴이 어느 부위에 있어?"
    REPORT_GENERATION = "report_generation"        # "판독문을 작성해줘"
    EVIDENCE_EXPLANATION = "evidence_explanation"  # "왜 폐렴이라고 판단했어?"
    CLINICAL_GUIDANCE = "clinical_guidance"        # "다음에 어떤 검사가 필요해?"
    LITERATURE_SEARCH = "literature_search"        # "흉수의 영상학적 기준을 찾아줘"
    TEMPORAL_COMPARISON = "temporal_comparison"    # "지난 X-ray보다 좋아졌어?"
    UNCERTAINTY_CHECK = "uncertainty_check"        # "이 결과를 얼마나 믿을 수 있어?"


class ToolName(str, Enum):
    """Evidence 를 생산하는 도구 식별자."""

    GATEKEEPER = "gatekeeper"
    CLASSIFIER = "classifier"
    LOCALIZER = "localizer"
    VQA = "vqa"
    QUANTIFIER = "quantifier"
    KNOWLEDGE = "knowledge"
    CASE = "case"


class EvidenceType(str, Enum):
    """근거의 출처 성격. Trust 계산에서 가중치 축으로 쓰인다."""

    MODEL = "model"            # 환자 영상에서 모델이 도출한 근거 (담당 A)
    LITERATURE = "literature"  # 외부 문헌 근거 (담당 B)
    CASE = "case"              # 유사 증례 근거 (담당 B)


class ToolStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class PacketStatus(str, Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"    # 일부 도구 실패
    BLOCKED = "blocked"    # Gatekeeper 차단


class Verdict(str, Enum):
    """Trust & Conflict Resolver 의 최종 상태."""

    ACCEPT = "ACCEPT"
    CAUTION = "CAUTION"
    NEED_MORE_EVIDENCE = "NEED_MORE_EVIDENCE"
    REJECT = "REJECT"
