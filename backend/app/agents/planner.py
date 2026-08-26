"""[담당 A] Query & Evidence Planner - 파이프라인 전체 라우팅의 시작점."""

from __future__ import annotations

from app.schemas.query import QueryPlan


def plan(case_id: str, query: str, has_image: bool) -> QueryPlan:
    """질문을 분류하고 필요한 근거와 도구 호출 순서를 결정한다.

    구현 순서 제안:
      1. query_type 분류 (LLM few-shot 또는 규칙 기반으로 시작)
      2. query_type -> required_evidence 매핑
      3. required_evidence -> tool_order 로 위상 정렬
         (예: LOCALIZATION 이면 classifier 가 양성일 때만 localizer 호출)
    """
    raise NotImplementedError("담당 A: Planner 구현")
