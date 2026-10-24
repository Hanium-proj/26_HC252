"""Actual published case reports; never claim patient/image similarity."""

from fastapi import APIRouter, HTTPException, Query

from app.api.routes.literature import search
from app.core.ai import public_error
from app.retrieval.local_corpus import search_cases

router = APIRouter(prefix="/cases", tags=["published cases"])


@router.get("/search")
async def cases(
    q: str = Query(min_length=2, max_length=1000),
    top_k: int = Query(5, ge=1, le=10),
    public: bool = False,
):
    if public:
        return await search(q=q, top_k=top_k, cases_only=True, public=True)
    try:
        return await search_cases(q, top_k)
    except Exception as exc:
        raise HTTPException(503, public_error(exc)) from exc
