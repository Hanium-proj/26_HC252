"""Evaluate supplied independent labeled images, never substitute synthetic labels.

Manifest CSV: path,patient_id,<one or more exact model class names>.
Labels: 0/1; blank and -1 are excluded. One study per patient is required.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from time import perf_counter

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.tools.vision.images import decode_image  # noqa: E402
from app.tools.vision.local_model import model  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--dataset-description", required=True)
    parser.add_argument("--split-provenance", required=True)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--output", type=Path, default=Path("data/live/classifier-evaluation.json"))
    args = parser.parse_args()
    if not 0 < args.threshold < 1:
        parser.error("threshold must be between 0 and 1")
    import torch
    import torchxrayvision as xrv
    from sklearn.metrics import average_precision_score, roc_auc_score

    rows = list(csv.DictReader(args.manifest.open()))
    if not rows or any(not r.get("patient_id") or not r.get("path") for r in rows):
        parser.error("path and patient_id required for every row")
    if len({r["patient_id"] for r in rows}) != len(rows):
        parser.error("Use one study per patient for this patient-level evaluation")
    net = model()
    predictions, elapsed = [], []
    for row in rows:
        image_path = (args.manifest.parent / row["path"]).resolve()
        image = decode_image(image_path.read_bytes(), image_path.name)
        arr = np.asarray(image, dtype=np.float32)
        normalized = xrv.datasets.normalize(arr, 255)[None, ...]
        normalized = xrv.datasets.XRayCenterCrop()(normalized)
        normalized = xrv.datasets.XRayResizer(224)(normalized)
        started = perf_counter()
        with torch.inference_mode():
            predictions.append(net(torch.from_numpy(normalized)[None, ...])[0].numpy())
        elapsed.append((perf_counter() - started) * 1000)
    predictions = np.asarray(predictions)
    metrics = {}
    for index, label in enumerate(net.pathologies):
        selected = [
            (i, float(r[label]))
            for i, r in enumerate(rows)
            if r.get(label, "").strip() in {"0", "0.0", "1", "1.0"}
        ]
        if not selected:
            continue
        indices, truth = zip(*selected, strict=False)
        y = np.asarray(truth)
        score = predictions[list(indices), index]
        positives = int(y.sum())
        negatives = len(y) - positives
        decision = score >= args.threshold
        metrics[label] = {
            "n": len(y),
            "positive": positives,
            "negative": negatives,
            "auroc": float(roc_auc_score(y, score)) if positives and negatives else None,
            "average_precision": float(average_precision_score(y, score)) if positives else None,
            "sensitivity": float(decision[y == 1].mean()) if positives else None,
            "specificity": float((~decision[y == 0]).mean()) if negatives else None,
        }
    report = {
        "dataset": args.dataset_description,
        "split_provenance": args.split_provenance,
        "model": "densenet121-res224-all",
        "patient_count": len(rows),
        "threshold": args.threshold,
        "metrics": metrics,
        "inference_p50_ms": float(np.median(elapsed)),
        "inference_p95_ms": float(np.percentile(elapsed, 95)),
        "limitations": [
            "Dataset provenance is supplied by the operator, not independently verified.",
            "Published model training overlap must be checked before claiming external validation.",
            "No deployment threshold calibration or clinical certification is implied.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2))
    print("Evaluation saved:", args.output)


if __name__ == "__main__":
    main()
