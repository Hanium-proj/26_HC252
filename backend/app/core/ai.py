"""One bounded, reusable async OpenAI client; no provider secrets in errors."""

from __future__ import annotations

import asyncio
from functools import lru_cache

from openai import AsyncOpenAI

from app.core.config import get_settings


@lru_cache
def client() -> AsyncOpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY 설정이 필요합니다")
    return AsyncOpenAI(
        api_key=settings.openai_api_key, timeout=settings.request_timeout, max_retries=1
    )


@lru_cache
def limiter() -> asyncio.Semaphore:
    return asyncio.Semaphore(get_settings().max_concurrent_ai)


def public_error(exc: Exception) -> str:
    from openai import APIConnectionError, AuthenticationError, RateLimitError

    if isinstance(exc, AuthenticationError):
        return "OpenAI 인증 실패. 서버 API 키를 확인해 주세요."
    if isinstance(exc, RateLimitError):
        return "OpenAI 사용 한도 또는 요청 제한에 도달했습니다. 잠시 후 재시도해 주세요."
    if isinstance(exc, APIConnectionError | TimeoutError):
        return "외부 서비스 연결이 지연되고 있습니다. 재시도해 주세요."
    return "처리를 완료하지 못했습니다. 서버 로그의 요청 ID를 확인해 주세요."
