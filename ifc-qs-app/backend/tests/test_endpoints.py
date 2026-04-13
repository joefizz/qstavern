"""Integration tests for the full API (upload → query → export)."""
import pytest
from pathlib import Path


def _upload(client, path: Path) -> str:
    with open(path, "rb") as f:
        resp = client.post(
            "/api/upload",
            files={"file": (path.name, f, "application/octet-stream")},
        )
    assert resp.status_code == 200
    return resp.json()["file_id"]


@pytest.fixture(scope="module")
def file_id(client, ifc4_path: Path):
    if not ifc4_path.exists():
        pytest.skip("Fixture not found — run generate_fixtures.py")
    return _upload(client, ifc4_path)


def test_summary_endpoint(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["project_name"] == "Test Project"
    assert "Level 1" in body["storeys"]


def test_quantities_endpoint(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/quantities")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all("guid" in r for r in data)


def test_quantities_filter_by_type(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/quantities", params={"ifc_type": "IfcWall"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["ifc_type"] == "IfcWall" for r in data)


def test_aggregates_by_type(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/aggregates", params={"group_by": "ifc_type"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all("group_value" in r for r in data)


def test_aggregates_by_storey(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/aggregates", params={"group_by": "storey"})
    assert resp.status_code == 200
    data = resp.json()
    assert any(r["group_value"] == "Level 1" for r in data)


def test_export_csv(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/export/csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().split("\n")
    assert len(lines) >= 2  # header + at least 1 row


def test_export_xlsx(client, file_id: str):
    resp = client.get(f"/api/files/{file_id}/export/xlsx")
    assert resp.status_code == 200
    assert "spreadsheetml" in resp.headers["content-type"]
    assert len(resp.content) > 0


def test_404_unknown_file(client):
    resp = client.get("/api/files/nonexistent-id/summary")
    assert resp.status_code == 404
