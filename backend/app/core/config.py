"""환경 설정. 시크릿은 전부 .env 에서만 읽는다 (하드코딩 금지)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # utf-8-sig: Windows 에디터가 .env 앞에 붙이는 BOM 을 무시한다. BOM 이 있으면
    # 첫 줄 키가 '﻿OPENAI_API_KEY' 로 읽혀 조용히 빈 값이 된다.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8-sig", extra="ignore"
    )

    app_name: str = "chest-ai-backend"
    environment: str = "development"

    # 설정되면 보호 엔드포인트에 X-API-Key 헤더 검사가 걸린다.
    # MIMIC 파생 데이터를 반환하는 /cases 는 배포 시 반드시 설정해야 한다.
    api_key: str = ""
    deployment_import_token: str = ""

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
    vision_model: str = "gpt-4.1"
    chat_model: str = "gpt-4.1-mini"
    data_dir: str = "data/live"
    max_upload_bytes: int = 15 * 1024 * 1024
    max_concurrent_ai: int = 2
    request_timeout: float = 90.0
    literature_cache_seconds: int = 3600
    retrieval_min_similarity: float = 0.30

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
