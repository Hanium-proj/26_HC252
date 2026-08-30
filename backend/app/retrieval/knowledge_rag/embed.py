"""[담당 B] 3단계 - 임베딩. OpenAI text-embedding-3-large.

MedCPT 대신 OpenAI 를 택한 이유:
  - MedCPT Article Encoder 는 입력 512 토큰 한계라 700 토큰 chunk 가 잘린다.
  - MedCPT 는 PubMed 초록 쌍으로 학습돼 guideline 본문 산문과 분포가 다르다.
  - 코퍼스가 작아(약 54만 토큰) 전량 임베딩 비용이 $0.07 수준이다.
Phase 2 에서 MedCPT 와 8개 테스트 쿼리로 비교 평가할 예정이다.
"""

from __future__ import annotations

import time

import tiktoken
from openai import AsyncOpenAI, OpenAI, RateLimitError

from app.core.config import get_settings

ENC = tiktoken.get_encoding("cl100k_base")

# 배치는 개수가 아니라 *토큰 예산* 으로 자른다. chunk 개수로 자르면 chunk 길이가
# 들쭉날쭉할 때 요청 하나가 TPM 한도를 넘어 429 가 난다.
BATCH_TOKENS = 30_000

# 계정 등급별 분당 토큰 한도. 초과하면 429 가 나므로 클라이언트에서 미리 페이싱한다.
TOKENS_PER_MINUTE = 40_000


class _RateLimiter:
    """60초 롤링 윈도우 토큰 버킷.

    서버가 429 를 던진 뒤 재시도하는 것보다, 보낼 때 미리 속도를 맞추는 편이
    전체 소요 시간이 짧고 실패 로그도 안 남는다.
    """

    def __init__(self, tpm: int = TOKENS_PER_MINUTE) -> None:
        self.tpm = tpm
        self._events: list[tuple[float, int]] = []

    def acquire(self, tokens: int) -> None:
        while True:
            now = time.monotonic()
            self._events = [(t, n) for t, n in self._events if now - t < 60.0]
            used = sum(n for _, n in self._events)
            if used + tokens <= self.tpm or not self._events:
                self._events.append((now, tokens))
                return
            # 가장 오래된 기록이 윈도우를 벗어날 때까지 대기
            time.sleep(max(60.0 - (now - self._events[0][0]), 0.1))


def _client() -> OpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY 가 .env 에 없다")
    return OpenAI(api_key=settings.openai_api_key)


def _batches(texts: list[str], budget: int) -> list[tuple[list[str], int]]:
    """토큰 예산에 맞춰 입력을 자른다. (배치, 토큰수) 목록을 반환."""
    out: list[tuple[list[str], int]] = []
    cur: list[str] = []
    cur_tok = 0
    for t in texts:
        n = len(ENC.encode(t))
        if cur and cur_tok + n > budget:
            out.append((cur, cur_tok))
            cur, cur_tok = [], 0
        cur.append(t)
        cur_tok += n
    if cur:
        out.append((cur, cur_tok))
    return out


def embed_documents(
    texts: list[str],
    batch_tokens: int = BATCH_TOKENS,
    progress: bool = False,
) -> list[list[float]]:
    """문서 chunk 를 배치로 벡터화한다. 입력 순서를 그대로 유지한다."""
    settings = get_settings()
    client = _client()
    limiter = _RateLimiter()

    batches = _batches(texts, batch_tokens)
    vectors: list[list[float]] = []

    for i, (batch, n_tok) in enumerate(batches, start=1):
        limiter.acquire(n_tok)

        for attempt in range(5):
            try:
                resp = client.embeddings.create(
                    model=settings.embedding_model, input=batch
                )
                break
            except RateLimitError:
                if attempt == 4:
                    raise
                # 페이싱을 뚫고 429 가 나면 지수 백오프로 물러선다
                time.sleep(2**attempt * 5)

        # API 가 순서를 보장하지만 index 로 재정렬해 둔다.
        # 순서가 어긋나면 chunk 와 벡터가 뒤섞여 조용히 잘못된 검색 결과가 나온다.
        ordered = sorted(resp.data, key=lambda d: d.index)
        vectors.extend(d.embedding for d in ordered)

        if progress:
            print(
                f"    배치 {i}/{len(batches)} · {len(vectors)}/{len(texts)} chunk",
                flush=True,
            )
    return vectors


def embed_query(text: str) -> list[float]:
    """질의를 벡터화한다.

    OpenAI 임베딩은 query/document 인코더가 분리돼 있지 않아 같은 모델을 쓴다.
    (MedCPT 로 교체할 경우 반드시 Query Encoder 를 따로 써야 한다.)
    """
    settings = get_settings()
    resp = _client().embeddings.create(model=settings.embedding_model, input=[text])
    return resp.data[0].embedding


async def aembed_query(text: str) -> list[float]:
    """FastAPI 라우트에서 쓰는 비동기 버전."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(model=settings.embedding_model, input=[text])
    return resp.data[0].embedding
