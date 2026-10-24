"""Measure actual proxy, searches and SSE; no patient data in output."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from time import perf_counter

import httpx
import numpy as np


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:3001")
    args = parser.parse_args()
    result = {}
    async with httpx.AsyncClient(base_url=args.url, timeout=180) as client:
        timings = []

        async def health():
            started = perf_counter()
            r = await client.get("/api/health")
            r.raise_for_status()
            timings.append((perf_counter() - started) * 1000)

        await asyncio.gather(*[health() for _ in range(20)])
        result["health_concurrent_20"] = {
            "p50_ms": round(float(np.median(timings)), 2),
            "p95_ms": round(float(np.percentile(timings, 95)), 2),
        }
        for path, label in [
            ("/api/literature/search", "knowledge"),
            ("/api/cases/search", "cases"),
        ]:
            started = perf_counter()
            r = await client.get(path, params={"q": "pneumothorax chest radiograph", "top_k": 5})
            r.raise_for_status()
            payload = r.json()
            result[label] = {
                "wall_ms": round((perf_counter() - started) * 1000),
                "hits": len(payload["hits"]),
                "cached": payload["cached"],
            }
        started = perf_counter()
        events = []
        answer = ""
        first = None
        sources = []
        done = None
        async with client.stream(
            "POST",
            "/api/agent/stream",
            json={
                "query": "흉부 X-ray에서 기흉의 관찰 소견을 실제 문헌에 근거해 설명해 주세요.",
                "history": [],
            },
        ) as response:
            response.raise_for_status()
            name = ""
            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    name = line[6:].strip()
                    events.append(name)
                if not line.startswith("data:"):
                    continue
                data = json.loads(line[5:])
                if name == "error":
                    raise RuntimeError(data["detail"])
                if name == "evidence":
                    sources = data["hits"]
                if name == "token":
                    if first is None:
                        first = (perf_counter() - started) * 1000
                    answer += data["text"]
                if name == "done":
                    done = data
        assert done and answer and sources, "Real SSE response did not complete"
        result["agent"] = {
            "wall_ms": round((perf_counter() - started) * 1000),
            "first_token_wall_ms": round(first),
            "source_count": len(sources),
            "characters": len(answer),
            "tokens": done["total_tokens"],
            "event_types": sorted(set(events)),
        }
        r = await client.post(
            "/api/agent/stream",
            json={
                "query": "그중 추가 확인이 필요한 근거를 요약해 주세요.",
                "history": [
                    {"role": "user", "content": "흉부 X-ray에서 기흉 소견은?"},
                    {"role": "assistant", "content": answer[:5000]},
                ],
            },
        )
        assert "event: done" in r.text and "event: error" not in r.text
        result["followup"] = "completed"
    out = Path("data/live/runtime-benchmark.json")
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
