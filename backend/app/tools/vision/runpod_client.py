"""Optional authenticated RunPod HTTP adapter; no dummy fallback."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings


async def infer(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.runpod_base_url or not settings.runpod_api_key:
        raise RuntimeError("RUNPOD_BASE_URL / RUNPOD_API_KEY가 설정되지 않았습니다")
    if not endpoint.startswith("/") or ".." in endpoint or "://" in endpoint:
        raise ValueError("Invalid model endpoint")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(120, connect=15), transport=httpx.AsyncHTTPTransport(retries=1)
    ) as client:
        response = await client.post(
            settings.runpod_base_url.rstrip("/") + endpoint,
            headers={"Authorization": "Bearer " + settings.runpod_api_key},
            json=payload,
        )
        response.raise_for_status()
        return response.json()
