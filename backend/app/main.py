"""FastAPI 진입점.

로컬 실행:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agent, analyze, cases, health, literature
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Chest AI Backend",
    description="흉부 X-ray 진단 지원 - Agent / Vision / RAG / Trust 파이프라인",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(literature.router)
app.include_router(cases.router)
app.include_router(agent.router)
