"""Persist extracted element data, model summary, and geometry to disk.

Sidecar files written into the uploads directory:
  {file_id}_cache.json        →  {"summary": {...}, "elements": [...]}
  {file_id}_geometry.json.gz  →  gzip-compressed JSON list of mesh dicts

This lets the app skip full IFC re-parsing / geometry extraction when a
previously processed file is re-opened after a container restart.
"""
from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Optional

from app.config import settings
from app.models.schemas import ModelSummary, QuantityRecord


def _cache_path(file_id: str) -> Path:
    return settings.upload_path / f"{file_id}_cache.json"


def has_cache(file_id: str) -> bool:
    return _cache_path(file_id).exists()


def save_cache(file_id: str, summary: ModelSummary, elements: list[QuantityRecord]) -> None:
    payload = {
        "summary": summary.model_dump(),
        "elements": [r.model_dump() for r in elements],
    }
    _cache_path(file_id).write_text(json.dumps(payload), encoding="utf-8")


def load_cache(file_id: str) -> Optional[tuple[ModelSummary, list[QuantityRecord]]]:
    path = _cache_path(file_id)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        summary = ModelSummary.model_validate(payload["summary"])
        elements = [QuantityRecord.model_validate(r) for r in payload["elements"]]
        return summary, elements
    except Exception:
        # Corrupted cache — delete and force re-extraction
        path.unlink(missing_ok=True)
        return None


def delete_cache(file_id: str) -> None:
    _cache_path(file_id).unlink(missing_ok=True)


# ── Geometry cache (gzipped JSON) ─────────────────────────────────────────────

def _geo_path(file_id: str) -> Path:
    return settings.upload_path / f"{file_id}_geometry.json.gz"


def has_geometry_cache(file_id: str) -> bool:
    return _geo_path(file_id).exists()


def save_geometry_cache(file_id: str, meshes: list[dict], version: int = 1) -> None:
    payload = {"version": version, "meshes": meshes}
    data = json.dumps(payload).encode("utf-8")
    _geo_path(file_id).write_bytes(gzip.compress(data, compresslevel=6))


def load_geometry_cache(file_id: str, version: int = 1) -> Optional[list[dict]]:
    path = _geo_path(file_id)
    if not path.exists():
        return None
    try:
        raw = json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))
        # Support old format (bare list) or new versioned format
        if isinstance(raw, list):
            meshes = raw
            cached_version = 1
        else:
            cached_version = raw.get("version", 1)
            meshes = raw.get("meshes", [])
        if cached_version != version:
            path.unlink(missing_ok=True)
            return None
        return meshes
    except Exception:
        path.unlink(missing_ok=True)
        return None


def delete_geometry_cache(file_id: str) -> None:
    _geo_path(file_id).unlink(missing_ok=True)
