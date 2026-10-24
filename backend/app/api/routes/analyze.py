from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.agents.live import analyze as run_analysis
from app.core.ai import public_error
from app.schemas.live import AnalyzeInput

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("")
async def analyze(req: AnalyzeInput):
    try:
        return await run_analysis(req.case_id, req.query)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        logging.getLogger(__name__).error("Analysis failed (%s)", type(exc).__name__)
        raise HTTPException(503, public_error(exc)) from exc
