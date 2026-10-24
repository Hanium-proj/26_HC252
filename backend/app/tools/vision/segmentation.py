"""Actual pretrained anatomical masks and explicit pixel-space measurements."""

from __future__ import annotations

from functools import lru_cache

import numpy as np
from PIL import Image

from app.core.storage import image_path


@lru_cache(maxsize=1)
def model():
    import torchxrayvision as xrv

    return xrv.baseline_models.chestx_det.PSPNet().eval()


def segment(case_id: str) -> dict:
    import torch
    import torch.nn.functional as functional

    image = Image.open(image_path(case_id)).convert("L")
    arr = np.asarray(image, dtype=np.float32) / 255 * 2048 - 1024
    tensor = torch.from_numpy(arr)[None, None, ...]
    tensor = functional.interpolate(tensor, size=(512, 512), mode="bilinear", align_corners=False)
    net = model()
    with torch.inference_mode():
        logits = net(tensor)
        masks = (
            functional.interpolate(
                logits.sigmoid(),
                size=(image.height, image.width),
                mode="bilinear",
                align_corners=False,
            )[0].numpy()
            >= 0.5
        )
    left = masks[net.targets.index("Left Lung")]
    right = masks[net.targets.index("Right Lung")]
    heart = masks[net.targets.index("Heart")]
    lungs = left | right
    overlay = np.zeros((*arr.shape, 4), dtype=np.uint8)
    overlay[lungs] = [30, 200, 200, 110]
    overlay[heart] = [255, 170, 40, 130]
    Image.fromarray(overlay).save(image_path(case_id, "anatomy"))
    Image.fromarray((lungs * 255).astype("uint8")).save(image_path(case_id, "lung-mask"))

    def span(mask):
        cols = np.where(mask.any(axis=0))[0]
        return int(cols[-1] - cols[0] + 1) if len(cols) else 0

    lung_span, heart_span = span(lungs), span(heart)
    ratio = heart_span / lung_span if lung_span and heart_span else None
    return {
        "model": "chestx-det-pspnet",
        "mask_url": f"/api/studies/{case_id}/image/anatomy",
        "lung_mask_url": f"/api/studies/{case_id}/image/lung-mask",
        "lung_fraction": round(float(lungs.mean()), 4),
        "heart_fraction": round(float(heart.mean()), 4),
        "heart_to_lung_span_ratio": round(ratio, 4) if ratio else None,
        "limitations": [
            "폐·심장 마스크는 연구용 분할 모델 출력이며 정답 분할이 아닙니다.",
            "폭 비율은 심장/폐영역의 픽셀 폭이며 임상 CTR 또는 mm 측정이 아닙니다.",
        ],
    }
