"""Unit tests for the core extraction engine (no HTTP layer)."""
import pytest
from pathlib import Path


def _load(path: Path):
    import ifcopenshell
    return ifcopenshell.open(str(path))


def test_summary_ifc4(ifc4_path: Path):
    if not ifc4_path.exists():
        pytest.skip("Fixture not found — run generate_fixtures.py")

    from app.core.summary import build_summary
    ifc = _load(ifc4_path)
    summary = build_summary("test-id", ifc)

    assert summary.ifc_schema == "IFC4"
    assert summary.project_name == "Test Project"
    assert "Level 1" in summary.storeys
    assert summary.element_count >= 1


def test_summary_ifc2x3(ifc2x3_path: Path):
    if not ifc2x3_path.exists():
        pytest.skip("Fixture not found — run generate_fixtures.py")

    from app.core.summary import build_summary
    ifc = _load(ifc2x3_path)
    summary = build_summary("test-id", ifc)

    assert summary.ifc_schema == "IFC2X3"


def test_extract_elements_authored(ifc4_path: Path):
    if not ifc4_path.exists():
        pytest.skip("Fixture not found — run generate_fixtures.py")

    from app.core.extractor import extract_elements
    ifc = _load(ifc4_path)
    records = extract_elements(ifc)

    assert len(records) >= 1
    wall = next((r for r in records if r.ifc_type == "IfcWall"), None)
    assert wall is not None
    assert wall.storey == "Level 1"
    assert wall.quantities.source == "authored"
    assert wall.quantities.area == pytest.approx(10.0, abs=0.01)
    assert wall.quantities.volume == pytest.approx(2.5, abs=0.01)
    assert wall.quantities.length == pytest.approx(5.0, abs=0.01)


def test_unit_detection_metres(ifc4_path: Path):
    if not ifc4_path.exists():
        pytest.skip("Fixture not found — run generate_fixtures.py")

    from app.core.units import detect_length_unit
    ifc = _load(ifc4_path)
    assert detect_length_unit(ifc) == "m"


def test_normalise():
    from app.core.units import normalise
    assert normalise(1000.0, "mm", 1) == pytest.approx(1.0)
    assert normalise(1_000_000.0, "mm", 2) == pytest.approx(1.0)
    assert normalise(1_000_000_000.0, "mm", 3) == pytest.approx(1.0)
    assert normalise(5.0, "m", 1) == pytest.approx(5.0)
    assert normalise(None, "m", 1) is None
