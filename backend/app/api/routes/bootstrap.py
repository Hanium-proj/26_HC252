"""Opt-in deployment import. Not exposed through the frontend proxy.

Disable DEPLOYMENT_IMPORT_TOKEN immediately after importing private indices.
Existing files can never be replaced; each upload must match its SHA-256.
"""

import hashlib
import os
import re
import secrets
import tempfile
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import get_settings
from app.core.storage import root

router = APIRouter(include_in_schema=False)
MAX_BYTES = 300 * 1024 * 1024
ALLOWED = {"knowledge-vectors.npz", "case-reports.sqlite3"}


@router.put("/internal/bootstrap/{filename}")
async def import_index(
    filename: str,
    request: Request,
    x_import_token: str = Header(default=""),
    x_content_sha256: str = Header(default=""),
):
    expected = get_settings().deployment_import_token
    if not expected:
        raise HTTPException(404)
    if not secrets.compare_digest(x_import_token, expected):
        raise HTTPException(401)
    if filename not in ALLOWED or not re.fullmatch(r"[a-f0-9]{64}", x_content_sha256):
        raise HTTPException(422, "Invalid filename or checksum")
    destination = root() / filename
    if destination.exists():
        raise HTTPException(409, "Existing indices cannot be overwritten")
    digest = hashlib.sha256()
    size = 0
    fd, name = tempfile.mkstemp(prefix=".import-", dir=root())
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as output:
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413)
                digest.update(chunk)
                output.write(chunk)
        if not size or digest.hexdigest() != x_content_sha256:
            raise HTTPException(422, "Checksum mismatch")
        # Hard-link publication is atomic and never overwrites a concurrent import.
        try:
            os.link(temporary, destination)
        except FileExistsError:
            raise HTTPException(409, "Existing indices cannot be overwritten") from None
        return {"filename": filename, "bytes": size, "sha256": digest.hexdigest()}
    finally:
        temporary.unlink(missing_ok=True)
