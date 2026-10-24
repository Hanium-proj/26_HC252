"""공통 의존성."""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """API 키 검사.

    `API_KEY` 가 비어 있으면 검사를 건너뛴다. 로컬 개발에서 매번 키를 넣지
    않게 하기 위함이며, 배포 환경에서는 반드시 설정해야 한다.

    비교에 secrets.compare_digest 를 쓰는 이유는 타이밍 공격 방지다.
    """
    expected = get_settings().api_key
    if not expected:
        if get_settings().environment != "development":
            raise HTTPException(503, "개발 환경 외에서는 API_KEY 설정이 필요합니다")
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효한 X-API-Key 헤더가 필요하다",
        )
