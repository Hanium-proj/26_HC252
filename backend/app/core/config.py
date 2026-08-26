"""환경 설정. 시크릿은 전부 .env 에서만 읽는다 (하드코딩 금지)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "chest-ai-backend"
    environment: str = "development"

    # CORS - Vercel 프론트 도메인. 쉼표로 여러 개
    allowed_origins: str = "http://localhost:3000"

    # RunPod 모델 서버
    runpod_base_url: str = ""
    runpod_api_key: str = ""

    # RAG
    ncbi_api_key: str = ""
    vector_db_url: str = ""

    # LLM
    llm_base_url: str = ""
    llm_api_key: str = ""

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
