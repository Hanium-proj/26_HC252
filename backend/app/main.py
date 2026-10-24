"""FastAPI 진입점.

로컬 실행:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import require_api_key
from app.api.routes import agent, analyze, cases, health, literature, replay, studies
from app.core.ai import client, limiter
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app):
    yield
    if client.cache_info().currsize:
        await client().close()
        client.cache_clear()
    limiter.cache_clear()


app = FastAPI(
    title="Chest AI Backend",
    description="흉부 X-ray 진단 지원 - Agent / Vision / RAG / Trust 파이프라인",
    version="0.1.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def observe(request, call_next):
    request_id = uuid.uuid4().hex[:16]
    started = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["Server-Timing"] = f"app_headers;dur={elapsed:.1f}"
    logging.getLogger("chest_ai.requests").info(
        "request=%s method=%s status=%s headers_ms=%.1f",
        request_id,
        request.method,
        response.status_code,
        elapsed,
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
for router in (
    analyze.router,
    literature.router,
    cases.router,
    agent.router,
    studies.router,
    replay.router,
):
    app.include_router(router, dependencies=[Depends(require_api_key)])
