import hashlib

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


@pytest.fixture
def importer(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "data_dir", str(tmp_path))
    monkeypatch.setattr(get_settings(), "deployment_import_token", "private-import-token")
    with TestClient(app) as client:
        yield client, tmp_path


def headers(data):
    return {
        "X-Import-Token": "private-import-token",
        "X-Content-Sha256": hashlib.sha256(data).hexdigest(),
    }


def test_import_checks_auth_and_hash_and_never_replaces(importer):
    client, root = importer
    url = "/internal/bootstrap/knowledge-vectors.npz"
    assert client.put(url, content=b"private").status_code == 401
    assert client.put(url, content=b"private", headers=headers(b"other")).status_code == 422
    assert not list(root.iterdir())
    assert client.put(url, content=b"private", headers=headers(b"private")).status_code == 200
    assert client.put(url, content=b"new", headers=headers(b"new")).status_code == 409
    assert (root / "knowledge-vectors.npz").read_bytes() == b"private"


def test_import_disabled_and_allowlist(importer, monkeypatch):
    client, root = importer
    assert (
        client.put(
            "/internal/bootstrap/worklist.sqlite3", content=b"x", headers=headers(b"x")
        ).status_code
        == 422
    )
    monkeypatch.setattr(get_settings(), "deployment_import_token", "")
    assert (
        client.put(
            "/internal/bootstrap/knowledge-vectors.npz", content=b"x", headers=headers(b"x")
        ).status_code
        == 404
    )
    assert not list(root.iterdir())
