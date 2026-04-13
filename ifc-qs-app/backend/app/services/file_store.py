"""In-process registry mapping file_id → path on disk, plus metadata helpers."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import settings

_store: dict[str, Path] = {}


# ── Core path helpers ─────────────────────────────────────────────────────────

def _meta_path(file_id: str) -> Path:
    return settings.upload_path / f"{file_id}_meta.json"


def find_by_hash(sha256: str) -> Optional[dict]:
    """Return metadata dict if a file with this hash already exists."""
    for meta_file in settings.upload_path.glob("*_meta.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        if meta.get("sha256") == sha256 and get_path(meta.get("file_id", "")) is not None:
            return meta
    return None


def save_file(data: bytes, filename: str) -> tuple[str, Path]:
    file_id = str(uuid.uuid4())
    dest = settings.upload_path / f"{file_id}_{filename}"
    dest.write_bytes(data)
    _store[file_id] = dest

    sha256 = hashlib.sha256(data).hexdigest()

    # Write sidecar metadata so the library survives restarts
    _meta_path(file_id).write_text(
        json.dumps({
            "file_id":    file_id,
            "filename":   filename,
            "size_bytes": len(data),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "sha256":     sha256,
        }),
        encoding="utf-8",
    )

    return file_id, dest


def get_path(file_id: str) -> Optional[Path]:
    path = _store.get(file_id)
    if path and path.exists():
        return path
    # Recover from restart by scanning the upload dir
    for candidate in settings.upload_path.glob(f"{file_id}_*.ifc"):
        _store[file_id] = candidate
        return candidate
    return None


# ── File library ──────────────────────────────────────────────────────────────

def list_files() -> list[dict]:
    """Return metadata for every IFC file in the upload directory.

    Files uploaded before sidecars were introduced (legacy files) are
    discovered by scanning for *.ifc directly.  A sidecar is written on
    first discovery so they appear correctly from then on.
    """
    records: list[dict] = []
    seen_ids: set[str] = set()

    # ── Files that already have a sidecar ──────────────────────────────────
    for meta_file in settings.upload_path.glob("*_meta.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        file_id = meta.get("file_id", "")
        if not file_id or get_path(file_id) is None:
            continue
        meta["is_processed"] = (settings.upload_path / f"{file_id}_cache.json").exists()
        records.append(meta)
        seen_ids.add(file_id)

    # ── Legacy IFC files without a sidecar ────────────────────────────────
    import uuid as _uuid
    for ifc_path in settings.upload_path.glob("*.ifc"):
        stem = ifc_path.stem           # "{uuid}_{original_name}"
        parts = stem.split("_", 1)
        if len(parts) != 2:
            continue
        file_id, base_name = parts
        try:
            _uuid.UUID(file_id)
        except ValueError:
            continue
        if file_id in seen_ids:
            continue

        stat = ifc_path.stat()
        filename = base_name + ".ifc"
        uploaded_at = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
        meta = {
            "file_id":     file_id,
            "filename":    filename,
            "size_bytes":  stat.st_size,
            "uploaded_at": uploaded_at,
        }
        meta["is_processed"] = (settings.upload_path / f"{file_id}_cache.json").exists()

        # Write sidecar so this file gets proper tracking going forward
        try:
            _meta_path(file_id).write_text(json.dumps(meta), encoding="utf-8")
        except Exception:
            pass

        _store[file_id] = ifc_path
        records.append(meta)
        seen_ids.add(file_id)

    records.sort(key=lambda r: r.get("uploaded_at", ""), reverse=True)
    return records


def delete_file(file_id: str) -> bool:
    """Delete IFC, meta, and cache files. Returns True if the IFC existed."""
    ifc_path = get_path(file_id)
    if ifc_path is None:
        return False

    ifc_path.unlink(missing_ok=True)
    _meta_path(file_id).unlink(missing_ok=True)
    (settings.upload_path / f"{file_id}_cache.json").unlink(missing_ok=True)
    _store.pop(file_id, None)
    return True
