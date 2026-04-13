"""Shared pytest fixtures."""
import io
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Point upload dir to a temp directory so tests are isolated
_tmp_dir = tempfile.mkdtemp()
os.environ.setdefault("UPLOAD_DIR", _tmp_dir)

from app.main import app  # noqa: E402 — must be after env var is set


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def ifc2x3_path() -> Path:
    return Path(__file__).parent / "fixtures" / "sample_ifc2x3.ifc"


@pytest.fixture(scope="session")
def ifc4_path() -> Path:
    return Path(__file__).parent / "fixtures" / "sample_ifc4.ifc"
