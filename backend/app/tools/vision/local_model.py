"""Real pretrained DenseNet inference and Grad-CAM, serialized on CPU.

Scores are research model outputs, NOT calibrated disease probabilities.
CAM is class activation, NOT segmentation or evidence of causality.
"""

from __future__ import annotations

import threading
from functools import lru_cache
from time import perf_counter

import numpy as np
from PIL import Image

from app.core.storage import image_path

_lock = threading.Lock()
WEIGHTS = "densenet121-res224-all"


@lru_cache(maxsize=1)
def model():
    import torch
    import torchxrayvision as xrv

    torch.set_num_threads(2)
    net = xrv.models.DenseNet(weights=WEIGHTS, apply_sigmoid=True)
    # Keep raw sigmoid scores; do not re-map dataset operating thresholds to 0.5.
    net.op_threshs = None
    net.eval()
    return net


def infer(case_id: str) -> dict:
    import torch
    import torch.nn.functional as functional
    import torchxrayvision as xrv

    started = perf_counter()
    with _lock:
        net = model()
        image = Image.open(image_path(case_id)).convert("L")
        arr = np.asarray(image, dtype=np.float32)
        side = min(arr.shape)
        y, x = (arr.shape[0] - side) // 2, (arr.shape[1] - side) // 2
        crop = arr[y : y + side, x : x + side]
        crop = xrv.datasets.normalize(crop, 255)[None, ...]
        crop = xrv.datasets.XRayResizer(224)(crop)
        tensor = torch.from_numpy(crop).unsqueeze(0).requires_grad_(True)
        # Match DenseNet.forward before its optional threshold normalization.
        features = net.features(tensor)
        activated = functional.relu(features, inplace=False)
        logits = net.classifier(functional.adaptive_avg_pool2d(activated, (1, 1)).flatten(1))
        scores = logits.sigmoid()[0]
        order = scores.detach().argsort(descending=True).tolist()
        findings = []
        for idx in order:
            cam_url = None
            coverage = None
            # All classes get a real CAM, never a painted approximation.
            grads = torch.autograd.grad(logits[0, idx], features, retain_graph=True)[0]
            cam = functional.relu((grads.mean((2, 3), keepdim=True) * features).sum(1))[0]
            cam = cam.detach().numpy()
            maximum = float(cam.max())
            if maximum > 0:
                cam = cam / maximum
                heat = Image.fromarray((cam * 255).astype("uint8")).resize(
                    (side, side), Image.Resampling.BILINEAR
                )
                # Transparent outside the center crop, matching the actual model FOV.
                heat_arr = np.asarray(heat) / 255.0
                rgba = np.zeros((image.height, image.width, 4), dtype=np.uint8)
                rgba[y : y + side, x : x + side, 0] = 255
                rgba[y : y + side, x : x + side, 1] = (160 * (1 - heat_arr)).astype("uint8")
                rgba[y : y + side, x : x + side, 3] = (heat_arr * 190).astype("uint8")
                Image.fromarray(rgba).save(image_path(case_id, f"cam-{idx}"))
                cam_url = f"/api/studies/{case_id}/image/cam-{idx}"
                coverage = round(float((heat_arr >= 0.5).mean()), 4)
            findings.append(
                {
                    "name": net.pathologies[idx],
                    "score": round(float(scores[idx].detach()), 5),
                    "cam_url": cam_url,
                    "activation_fraction": coverage,
                }
            )
        return {
            "model": WEIGHTS,
            "findings": findings,
            "latency_ms": round((perf_counter() - started) * 1000),
            "crop": {"x": x, "y": y, "size": side},
            "score_type": "uncalibrated_sigmoid",
            "limitations": [
                "연구용 모델 출력이며 보정된 질병 확률이 아닙니다.",
                "중앙 정사각형 크롭을 사용해 주변부가 제외될 수 있습니다.",
                "Grad-CAM은 모델 활성 영역이며 병변 분할·실측 크기가 아닙니다.",
            ],
        }
