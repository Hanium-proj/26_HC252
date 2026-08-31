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

    # RAG - 임베딩
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-large"
    embedding_dim: int = 3072

    # Phase 2 - 질의 번역 및 리랭킹
    translate_model: str = "gpt-4o-mini"
    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rrf_k: int = 60

    # RAG - Qdrant. qdrant_url 이 비면 qdrant_path 로컬 파일 모드
    qdrant_path: str = "data/qdrant"
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    knowledge_collection: str = "knowledge_guidelines_reviews"
    case_collection: str = "radiology_cases"

    # RAG - 코퍼스
    corpus_dir: str = "data/knowledge_rag_v1"

    ncbi_api_key: str = ""

    # LLM
    llm_base_url: str = ""
    llm_api_key: str = ""

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
