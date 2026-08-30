"""[담당 B] 3단계 - 임베딩. OpenAI text-embedding-3-large.

MedCPT 대신 OpenAI 를 택한 이유:
  - MedCPT Article Encoder 는 입력 512 토큰 한계라 700 토큰 chunk 가 잘린다.
  - MedCPT 는 PubMed 초록 쌍으로 학습돼 guideline 본문 산문과 분포가 다르다.
  - 코퍼스가 작아(약 54만 토큰) 전량 임베딩 비용이 $0.07 수준이다.
Phase 2 에서 MedCPT 와 8개 테스트 쿼리로 비교 평가할 예정이다.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import tiktoken
from openai import AsyncOpenAI, OpenAI, RateLimitError

from app.core.config import get_settings

ENC = tiktoken.get_encoding("cl100k_base")

# 배치는 개수가 아니라 *토큰 예산* 으로 자른다. chunk 개수로 자르면 chunk 길이가
# 들쭉날쭉할 때 요청 하나가 TPM 한도를 넘어 429 가 난다.
#
# 예산을 한도(40K)보다 훨씬 작게 잡는 이유: OpenAI 의 토큰 버킷은 60초 단위로
# 한 번에 리셋되는 게 아니라 연속 리필된다(40K/min = 약 666 tok/s).
# 큰 배치를 쓰면 "버킷이 가득 찰 때까지 대기 -> 한 번에 소진" 패턴이 되어
# 한도의 절반만 쓰게 된다. 작은 배치로 흘려보내야 실효 처리량이 한도에 근접한다.
BATCH_TOKENS = 8_000

# 요청당 입력 배열 최대 길이 (OpenAI embeddings API 제약)
MAX_BATCH_ITEMS = 2_048

# 계정 등급의 분당 토큰 한도. 버킷은 이 값을 60으로 나눈 속도로 연속 리필된다.
TOKENS_PER_MINUTE = 40_000
REFILL_PER_SEC = TOKENS_PER_MINUTE / 60.0


def _cache_path(model: str) -> Path:
    return Path(get_settings().qdrant_path).parent / f"embed_cache_{model}.jsonl"


def _key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:32]


def _load_cache(path: Path) -> dict[str, list[float]]:
    """이전 실행에서 만든 벡터를 재사용한다.

    임베딩은 결정적이고 비용/시간이 드는 연산이라, 중단된 배치를 처음부터
    다시 도는 것은 낭비다. 텍스트 해시를 키로 캐싱한다.
    """
    if not path.exists():
        return {}
    cache: dict[str, list[float]] = {}
    with path.open() as f:
        for line in f:
            try:
                rec = json.loads(line)
                cache[rec["k"]] = rec["v"]
            except (json.JSONDecodeError, KeyError):
                continue  # 중단 시 마지막 줄이 잘렸을 수 있다
    return cache


def _client() -> OpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY 가 .env 에 없다")
    return OpenAI(api_key=settings.openai_api_key)


def _batches(
    texts: list[str], budget: int, max_items: int = MAX_BATCH_ITEMS
) -> list[list[int]]:
    """토큰 예산과 항목 수 상한에 맞춰 인덱스를 묶는다.

    항목 수 상한이 필요한 이유: 짧은 텍스트(리포트 평균 약 97 토큰)를 다룰 때
    토큰 예산만으로 자르면 배열 길이가 API 상한을 넘는다.
    """
    out: list[list[int]] = []
    cur: list[int] = []
    cur_tok = 0
    for i, t in enumerate(texts):
        n = len(ENC.encode(t))
        if cur and (cur_tok + n > budget or len(cur) >= max_items):
            out.append(cur)
            cur, cur_tok = [], 0
        cur.append(i)
        cur_tok += n
    if cur:
        out.append(cur)
    return out


def embed_stream(
    texts: list[str],
    batch_tokens: int = 150_000,
    max_items: int = MAX_BATCH_ITEMS,
):
    """대량 임베딩을 배치 단위로 yield 한다.

    embed_documents 는 전체 벡터를 메모리에 모으므로 수십만 건에는 쓸 수 없다.
    (3072차원 × 22만 건이면 Python 객체로 수십 GB) 호출자가 배치를 받는 즉시
    색인하고 버릴 수 있도록 generator 로 제공한다.

    yield: (시작 인덱스, 텍스트 리스트, 벡터 리스트)
    """
    settings = get_settings()
    client = _client()
    batches = _batches(texts, batch_tokens, max_items)

    for local_idx in batches:
        batch = [texts[i] for i in local_idx]
        for attempt in range(6):
            try:
                raw = client.embeddings.with_raw_response.create(
                    model=settings.embedding_model, input=batch
                )
                break
            except RateLimitError:
                if attempt == 5:
                    raise
                time.sleep(2**attempt * 3)

        resp = raw.parse()
        vectors = [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]
        yield local_idx, batch, vectors

        remaining = int(raw.headers.get("x-ratelimit-remaining-tokens", 0))
        deficit = batch_tokens - remaining
        if deficit > 0:
            limit = int(raw.headers.get("x-ratelimit-limit-tokens", TOKENS_PER_MINUTE))
            time.sleep(min(deficit / (limit / 60.0), 30.0))


def embed_documents(
    texts: list[str],
    batch_tokens: int = BATCH_TOKENS,
    progress: bool = False,
    use_cache: bool = True,
) -> list[list[float]]:
    """문서 chunk 를 배치로 벡터화한다. 입력 순서를 그대로 유지한다.

    속도 제어는 응답 헤더(x-ratelimit-remaining-tokens / -reset-tokens)로 한다.
    클라이언트가 자체 추정한 윈도우보다 서버가 알려주는 잔량이 정확하다.
    """
    settings = get_settings()
    client = _client()

    cache_file = _cache_path(settings.embedding_model)
    cache = _load_cache(cache_file) if use_cache else {}
    keys = [_key(t) for t in texts]

    todo = [i for i, k in enumerate(keys) if k not in cache]
    if progress and cache:
        print(f"    캐시 재사용 {len(texts) - len(todo)}개, 신규 {len(todo)}개", flush=True)

    batches = _batches([texts[i] for i in todo], batch_tokens)
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    done = 0

    with cache_file.open("a") as cf:
        for bi, local_idx in enumerate(batches, start=1):
            batch_idx = [todo[j] for j in local_idx]
            batch = [texts[i] for i in batch_idx]

            for attempt in range(6):
                try:
                    raw = client.embeddings.with_raw_response.create(
                        model=settings.embedding_model, input=batch
                    )
                    break
                except RateLimitError:
                    if attempt == 5:
                        raise
                    time.sleep(2**attempt * 3)

            resp = raw.parse()
            # API 가 순서를 보장하지만 index 로 재정렬해 둔다. 순서가 어긋나면
            # chunk 와 벡터가 뒤섞여 오류 없이 잘못된 검색 결과가 나온다.
            for d in sorted(resp.data, key=lambda d: d.index):
                i = batch_idx[d.index]
                cache[keys[i]] = d.embedding
                cf.write(json.dumps({"k": keys[i], "v": d.embedding}) + "\n")
            cf.flush()

            done += len(batch)
            if progress and (bi % 5 == 0 or bi == len(batches)):
                print(f"    배치 {bi}/{len(batches)} · {done}/{len(todo)} chunk", flush=True)

            # 서버가 알려준 잔량으로 다음 요청 시점을 정한다.
            #
            # reset-tokens 헤더는 버킷이 *가득 찰* 때까지의 시간이라 그대로 자면
            # 필요 이상으로 쉬게 된다. 다음 배치에 모자란 만큼만 리필을 기다린다.
            if bi < len(batches):
                remaining = int(raw.headers.get("x-ratelimit-remaining-tokens", 0))
                deficit = batch_tokens - remaining
                if deficit > 0:
                    time.sleep(min(deficit / REFILL_PER_SEC, 30.0))

    return [cache[k] for k in keys]


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
