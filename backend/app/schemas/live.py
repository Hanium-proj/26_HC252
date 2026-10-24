"""Validated contracts for live worklist, vision interpretation and chat."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ClinicalInput(BaseModel):
    note: str = Field(default="", max_length=6000)
    prior_id: str | None = None
    patient_ref: str = Field(default="", max_length=80)


class Observation(BaseModel):
    finding: str
    location: str
    description: str
    certainty: Literal["observed", "possible", "uncertain"]


class VisionReport(BaseModel):
    is_chest_xray: bool
    view: str
    quality: Literal["adequate", "limited", "uninterpretable"]
    quality_issues: list[str]
    observations: list[Observation]
    impression: str
    comparison: str | None
    limitations: list[str]


class AnalyzeInput(BaseModel):
    case_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    query: str = Field(
        default="흉부 X-ray의 관찰 가능한 소견을 설명해 주세요.", min_length=2, max_length=3000
    )


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class AgentInput(BaseModel):
    case_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    query: str = Field(min_length=2, max_length=3000)
    history: list[Message] = Field(default_factory=list, max_length=12)
    top_k: int = Field(default=5, ge=1, le=10)


class RetrievalQuery(BaseModel):
    english_query: str
