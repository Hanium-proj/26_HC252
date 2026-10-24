"""Uploaded studies; all image paths are server generated."""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.core.storage import get_case, image_path, list_cases, now, put_case
from app.schemas.live import ClinicalInput
from app.tools.vision.images import decode_image

router = APIRouter(prefix="/studies", tags=["studies"])


@router.get("")
def worklist():
    return list_cases()


@router.post("", status_code=201)
async def upload(file: UploadFile = File(...)):
    limit = get_settings().max_upload_bytes
    data = await file.read(limit + 1)
    await file.close()
    if len(data) > limit:
        raise HTTPException(413, "영상 파일은 15MB 이하여야 합니다")
    try:
        image = await asyncio.to_thread(decode_image, data, file.filename or "")
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    case_id = uuid.uuid4().hex
    await asyncio.to_thread(image.save, image_path(case_id), format="PNG")
    return put_case(
        {
            "id": case_id,
            "name": (file.filename or "uploaded-image")[:200],
            "created_at": now(),
            "updated_at": now(),
            "image_url": f"/api/studies/{case_id}/image/image",
            "width": image.width,
            "height": image.height,
            "clinical": {"note": "", "prior_id": None, "patient_ref": ""},
            "analysis": None,
        }
    )


@router.get("/{case_id}")
def read(case_id: str):
    case = get_case(case_id)
    if case is None:
        raise HTTPException(404, "검사를 찾을 수 없습니다")
    return case


@router.patch("/{case_id}")
def update(case_id: str, clinical: ClinicalInput):
    from app.agents.live import _active

    if case_id in _active:
        raise HTTPException(409, "분석 중에는 임상 정보를 수정할 수 없습니다")
    case = read(case_id)
    if clinical.prior_id:
        prior = get_case(clinical.prior_id)
        if clinical.prior_id == case_id or prior is None:
            raise HTTPException(422, "비교 검사 ID가 올바르지 않습니다")
        if not clinical.patient_ref.strip() or clinical.patient_ref != prior["clinical"].get(
            "patient_ref"
        ):
            raise HTTPException(422, "같은 익명 환자 식별자가 등록된 검사만 비교할 수 있습니다")
    if case["clinical"] != clinical.model_dump():
        case["analysis"] = None
    case["clinical"] = clinical.model_dump()
    case["updated_at"] = now()
    for dependent in list_cases():
        if (
            dependent["id"] != case_id
            and dependent["clinical"].get("prior_id") == case_id
            and dependent["clinical"].get("patient_ref") != clinical.patient_ref
        ):
            dependent["clinical"]["prior_id"] = None
            dependent["analysis"] = None
            dependent["updated_at"] = now()
            put_case(dependent)
    return put_case(case)


@router.get("/{case_id}/image/{kind}")
def image(case_id: str, kind: str):
    try:
        path = image_path(case_id, kind)
    except ValueError as exc:
        raise HTTPException(404, "영상을 찾을 수 없습니다") from exc
    if not path.exists():
        raise HTTPException(404, "영상을 찾을 수 없습니다")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "no-store"})
