"""Decode actual PNG/JPEG or single-frame monochrome DICOM, strip metadata."""

from __future__ import annotations

import io
import warnings

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 25_000_000


def decode_image(data: bytes, filename: str) -> Image.Image:
    if filename.lower().endswith(".dcm") or data[128:132] == b"DICM":
        import pydicom
        from pydicom.errors import InvalidDicomError
        from pydicom.pixels import apply_modality_lut, apply_voi_lut

        try:
            ds = pydicom.dcmread(io.BytesIO(data))
            if int(getattr(ds, "NumberOfFrames", 1)) != 1:
                raise ValueError("단일 프레임 흉부 X-ray만 지원합니다")
            if int(ds.Rows) * int(ds.Columns) > Image.MAX_IMAGE_PIXELS:
                raise ValueError("영상은 2,500만 픽셀 이하여야 합니다")
            if getattr(ds, "SamplesPerPixel", 1) != 1:
                raise ValueError("흑백 DICOM만 지원합니다")
            arr = apply_voi_lut(apply_modality_lut(ds.pixel_array, ds), ds).astype(float)
            lo, hi = np.percentile(arr, [0.5, 99.5])
            arr = np.clip((arr - lo) / max(hi - lo, 1e-6), 0, 1)
            if ds.PhotometricInterpretation == "MONOCHROME1":
                arr = 1 - arr
            image = Image.fromarray((arr * 255).astype("uint8"))
        except (
            ValueError,
            AttributeError,
            RuntimeError,
            InvalidDicomError,
            KeyError,
            TypeError,
        ) as exc:
            raise ValueError("DICOM 해독 실패. 단일 프레임 비압축 흑백 영상이 필요합니다") from exc
    else:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                image = Image.open(io.BytesIO(data))
                if image.format not in {"PNG", "JPEG"}:
                    raise ValueError("PNG, JPEG, DICOM만 지원합니다")
                image = ImageOps.exif_transpose(image).convert("L")
                image.load()
        except (
            UnidentifiedImageError,
            OSError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ) as exc:
            raise ValueError("손상되었거나 너무 큰 영상입니다") from exc
    if min(image.size) < 64:
        raise ValueError("영상 가로·세로가 64픽셀 이상이어야 합니다")
    image.thumbnail((2048, 2048))
    return image
