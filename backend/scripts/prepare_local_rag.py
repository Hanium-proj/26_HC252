"""Embed supplied real chunks, resume per batch, then atomically publish index."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.ai import client  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.storage import root  # noqa: E402


async def build(path: Path):
    chunks = json.loads(path.read_text())
    if not isinstance(chunks, list) or not chunks:
        raise ValueError("Empty or malformed corpus")
    model = get_settings().embedding_model
    cache = root() / "embedding-batches"
    cache.mkdir(exist_ok=True)
    vectors = []
    for start in range(0, len(chunks), 32):
        batch = chunks[start : start + 32]
        texts = [c["text"] for c in batch]
        fingerprint = hashlib.sha256((model + json.dumps(texts)).encode()).hexdigest()
        target = cache / f"{fingerprint}.npy"
        if target.exists():
            values = np.load(target, allow_pickle=False)
        else:
            result = await client().embeddings.create(model=model, input=texts)
            values = np.asarray(
                [v.embedding for v in sorted(result.data, key=lambda v: v.index)], dtype=np.float32
            )
            np.save(target, values)
        vectors.extend(values)
        print(f"Embedded {min(start + 32, len(chunks))}/{len(chunks)}", flush=True)
    target = root() / "knowledge-vectors.npz"
    tmp = root() / "knowledge-vectors.building.npz"
    np.savez_compressed(tmp, vectors=np.asarray(vectors), chunks=json.dumps(chunks), model=model)
    tmp.replace(target)
    print(f"Ready: {len(chunks)} chunks / {len({c['doc_id'] for c in chunks})} documents")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("chunks", type=Path)
    asyncio.run(build(parser.parse_args().chunks))
