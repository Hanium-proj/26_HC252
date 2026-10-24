"""Small fixed regression evaluation, NOT independent clinical validation."""

from __future__ import annotations

import asyncio
import json
import statistics
import sys
from pathlib import Path
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from eval_retrieval import QUERIES  # noqa: E402

from app.retrieval.local_corpus import search_cases, search_knowledge  # noqa: E402


async def main():
    report = {
        "scope": "8 existing topic queries per language; metadata-derived relevance labels",
        "limitation": (
            "Small developer regression set, " "not held-out retrieval or clinical validation"
        ),
        "languages": {},
    }
    for lang, offset in [("ko", 0), ("en", 1)]:
        rows = []
        for index, pair in enumerate(QUERIES):
            started = perf_counter()
            result = await search_knowledge(pair[offset], 5)
            docs = [h["doc_id"] for h in result["hits"]]
            rank = next((n for n, d in enumerate(docs, 1) if d in pair[2]), None)
            rows.append(
                {
                    "query": index + 1,
                    "rank": rank,
                    "docs": docs,
                    "wall_ms": round((perf_counter() - started) * 1000),
                    "cached": result["cached"],
                }
            )
        timings = sorted(r["wall_ms"] for r in rows)
        report["languages"][lang] = {
            "hit_at_1": sum(r["rank"] == 1 for r in rows) / len(rows),
            "hit_at_5": sum(r["rank"] is not None for r in rows) / len(rows),
            "mrr_at_5": sum(1 / r["rank"] if r["rank"] else 0 for r in rows) / len(rows),
            "p50_ms": statistics.median(timings),
            "max_ms": max(timings),
            "rows": rows,
        }
    started = perf_counter()
    await search_knowledge(QUERIES[0][0], 5)
    report["cached_lookup_ms"] = round((perf_counter() - started) * 1000, 2)
    case_result = await search_cases("pneumothorax chest radiograph", 5)
    report["case_search"] = {
        "hits": len(case_result["hits"]),
        "latency_ms": case_result["latency_ms"],
        "candidate_count": case_result["candidates"],
    }
    output = Path("data/live/retrieval-evaluation.json")
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(
        json.dumps(
            {
                k: v
                if k != "languages"
                else {
                    lang: {m: n for m, n in val.items() if m != "rows"} for lang, val in v.items()
                }
                for k, v in report.items()
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
