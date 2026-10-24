from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.ai import public_error
from app.retrieval.local_corpus import search_knowledge
from app.retrieval.publications import search_publications

router = APIRouter(prefix="/literature", tags=["literature"])


@router.get("/search")
async def search(
    q: str = Query(min_length=2, max_length=1000),
    top_k: int = Query(5, ge=1, le=10),
    cases_only: bool = False,
    public: bool = False,
):
    try:
        if public or cases_only:
            return await search_publications(q, top_k, cases_only)
        return await search_knowledge(q, top_k)
    except Exception as exc:
        logging.getLogger(__name__).error("Literature failed (%s)", type(exc).__name__)
        raise HTTPException(503, public_error(exc)) from exc
