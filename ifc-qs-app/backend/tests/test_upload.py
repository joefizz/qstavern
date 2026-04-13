"""Tests for file upload endpoint."""
from pathlib import Path


def test_upload_rejects_non_ifc(client):
    resp = client.post(
        "/api/upload",
        files={"file": ("test.txt", b"not an ifc file", "text/plain")},
    )
    assert resp.status_code == 400


def test_upload_ifc(client, ifc4_path: Path):
    if not ifc4_path.exists():
        import pytest
        pytest.skip("Fixture file not found — run generate_fixtures.py first")

    with open(ifc4_path, "rb") as f:
        resp = client.post(
            "/api/upload",
            files={"file": ("sample.ifc", f, "application/octet-stream")},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "file_id" in body
    assert body["filename"] == "sample.ifc"
    assert body["size_bytes"] > 0
