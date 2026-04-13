"""All /api/* endpoints for file upload, querying, and export."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Optional

import ifcopenshell
import ifcopenshell.geom
from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

import hashlib

from app.config import settings
from app.core.extractor import extract_elements
from app.core.summary import build_summary
from app.core.tree import build_tree
from app.models.schemas import (
    AggregateRow,
    AssembledElement,
    FileRecord,
    ModelSummary,
    QuantityRecord,
    UploadResponse,
)
from app.services import cache_store, file_store
from app.services.aggregator import aggregate
from app.services.assembler import apply_assemblies, bom_summary, reload_library
from app.services.exporter import to_csv, to_xlsx, to_xlsx_assembled

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_ifc(file_id: str) -> ifcopenshell.file:
    path = file_store.get_path(file_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"File '{file_id}' not found")
    try:
        return ifcopenshell.open(str(path))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot parse IFC file: {exc}")


# Simple in-process cache of extracted records (avoids re-parsing on every request)
_element_cache: dict[str, list[QuantityRecord]] = {}

# Cache for geometry meshes
_geometry_cache: dict[str, list[dict]] = {}

# Bump this when TARGET_TYPES or color/opacity logic changes — invalidates disk caches
_GEOMETRY_CACHE_VERSION = 3

# IFC type → RGB colour (0.0–1.0)
_TYPE_COLORS: dict[str, tuple[float, float, float]] = {
    "IfcWall":                  (0.86, 0.83, 0.76),
    "IfcWallStandardCase":      (0.86, 0.83, 0.76),
    "IfcSlab":                  (0.72, 0.72, 0.70),
    "IfcRoof":                  (0.72, 0.38, 0.30),
    "IfcBeam":                  (0.55, 0.70, 0.85),
    "IfcColumn":                (0.50, 0.70, 0.50),
    "IfcDoor":                  (0.62, 0.46, 0.30),
    "IfcWindow":                (0.65, 0.82, 0.94),
    "IfcStair":                 (0.78, 0.78, 0.58),
    "IfcStairFlight":           (0.78, 0.78, 0.58),
    "IfcRailing":               (0.52, 0.52, 0.62),
    "IfcRamp":                  (0.75, 0.72, 0.55),
    "IfcRampFlight":            (0.75, 0.72, 0.55),
    "IfcCovering":              (0.82, 0.80, 0.74),
    "IfcCurtainWall":           (0.65, 0.82, 0.94),
    "IfcPlate":                 (0.60, 0.72, 0.80),
    "IfcMember":                (0.55, 0.65, 0.78),
    "IfcPile":                  (0.58, 0.55, 0.50),
    "IfcFooting":               (0.62, 0.60, 0.55),
    "IfcFurnishingElement":     (0.80, 0.65, 0.50),
    "IfcFurniture":             (0.80, 0.65, 0.50),
    "IfcSystemFurnitureElement":(0.78, 0.65, 0.52),
    "IfcSanitaryTerminal":      (0.90, 0.90, 0.90),
    "IfcElectricAppliance":     (0.70, 0.70, 0.75),
    "IfcSite":                  (0.45, 0.65, 0.35),
    "IfcBuildingElementProxy":  (0.72, 0.68, 0.62),
}
_DEFAULT_COLOR: tuple[float, float, float] = (0.75, 0.75, 0.75)
_TRANSPARENT_TYPES = {"IfcWindow", "IfcCurtainWall"}


def _get_elements(file_id: str) -> list[QuantityRecord]:
    if file_id not in _element_cache:
        # Try disk cache before parsing the IFC file
        cached = cache_store.load_cache(file_id)
        if cached:
            _, elements = cached
            _element_cache[file_id] = elements
        else:
            ifc = _load_ifc(file_id)
            _element_cache[file_id] = extract_elements(ifc)
    return _element_cache[file_id]


# ── File library ─────────────────────────────────────────────────────────────

@router.get("/files", response_model=list[FileRecord])
async def list_files():
    """Return metadata for all previously uploaded IFC files."""
    return file_store.list_files()


@router.delete("/files/{file_id}", status_code=204)
async def delete_file(file_id: str):
    """Permanently delete an IFC file and all its cached data."""
    found = file_store.delete_file(file_id)
    if not found:
        raise HTTPException(status_code=404, detail=f"File '{file_id}' not found")
    _element_cache.pop(file_id, None)
    _geometry_cache.pop(file_id, None)
    cache_store.delete_geometry_cache(file_id)


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".ifc"):
        raise HTTPException(status_code=400, detail="Only .ifc files are accepted")

    data = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_file_size_mb} MB limit",
        )

    # Duplicate detection — return 409 with existing file_id if hash matches
    sha256 = hashlib.sha256(data).hexdigest()
    existing = file_store.find_by_hash(sha256)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate",
                "file_id": existing["file_id"],
                "filename": existing["filename"],
            },
        )

    file_id, _ = file_store.save_file(data, file.filename)

    return UploadResponse(
        file_id=file_id,
        filename=file.filename,
        size_bytes=len(data),
    )


# ── Process (SSE) ─────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/process")
async def process_file(file_id: str):
    """Stream processing progress via Server-Sent Events.

    Final event: {"stage":"complete","percent":100,"summary":{...}}
    Error event: {"stage":"error","message":"..."}
    """
    async def event_stream():
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        path = file_store.get_path(file_id)
        if path is None:
            yield sse({"stage": "error", "message": f"File '{file_id}' not found"})
            return

        q: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def push(pct: int, msg: str) -> None:
            loop.call_soon_threadsafe(q.put_nowait, {"percent": pct, "message": msg})

        def do_work() -> None:
            try:
                # Fast path: return cached data without re-parsing the IFC
                cached = cache_store.load_cache(file_id)
                if cached:
                    summary, records = cached
                    _element_cache[file_id] = records
                    push(50, "Loading cached data…")
                    loop.call_soon_threadsafe(q.put_nowait, {
                        "stage": "complete",
                        "percent": 100,
                        "message": f"Loaded from cache — {len(records)} elements",
                        "summary": summary.model_dump(),
                    })
                    return

                push(5, "Opening IFC file…")
                ifc = ifcopenshell.open(str(path))

                push(15, "Reading project structure…")
                summary = build_summary(file_id, ifc)

                records = extract_elements(ifc, progress_cb=push)

                _element_cache[file_id] = records
                cache_store.save_cache(file_id, summary, records)
                loop.call_soon_threadsafe(q.put_nowait, {
                    "stage": "complete",
                    "percent": 100,
                    "message": f"Done — {len(records)} elements processed",
                    "summary": summary.model_dump(),
                })
            except Exception as exc:
                loop.call_soon_threadsafe(q.put_nowait, {
                    "stage": "error",
                    "message": str(exc),
                })

        future = loop.run_in_executor(None, do_work)

        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=60.0)
                yield sse(item)
                if item.get("stage") in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                yield sse({"percent": -1, "message": "Still processing…"})

        await future

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/summary", response_model=ModelSummary)
async def get_summary(file_id: str):
    ifc = _load_ifc(file_id)
    return build_summary(file_id, ifc)


# ── Quantities ────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/quantities", response_model=list[QuantityRecord])
async def get_quantities(
    file_id: str,
    ifc_type: Optional[str] = Query(None),
    storey: Optional[str] = Query(None),
    external_only: bool = Query(False),
):
    records = _get_elements(file_id)

    if ifc_type:
        records = [r for r in records if r.ifc_type == ifc_type]
    if storey:
        records = [r for r in records if r.storey == storey]
    if external_only:
        records = [r for r in records if r.is_external]

    return records


# ── Aggregates ────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/aggregates", response_model=list[AggregateRow])
async def get_aggregates(
    file_id: str,
    group_by: str = Query("ifc_type", pattern="^(ifc_type|storey)$"),
):
    records = _get_elements(file_id)
    return aggregate(records, group_by)  # type: ignore[arg-type]


# ── Single element ───────────────────────────────────────────────────────────

@router.get("/files/{file_id}/elements/{guid}", response_model=QuantityRecord)
async def get_element(file_id: str, guid: str):
    records = _get_elements(file_id)
    match = next((r for r in records if r.guid == guid), None)
    if match is None:
        raise HTTPException(status_code=404, detail=f"Element '{guid}' not found")
    return match


# ── Tree ──────────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/tree")
async def get_tree(file_id: str):
    ifc = _load_ifc(file_id)
    return build_tree(ifc)


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/files/{file_id}/export/csv")
async def export_csv(file_id: str):
    records = _get_elements(file_id)
    csv_bytes = to_csv(records)
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=quantities_{file_id}.csv"},
    )


@router.get("/files/{file_id}/export/xlsx")
async def export_xlsx(file_id: str):
    records = _get_elements(file_id)
    xlsx_bytes = to_xlsx(records)
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=quantities_{file_id}.xlsx"},
    )


# ── Assembly Schedule ─────────────────────────────────────────────────────────

@router.get("/files/{file_id}/assembled-schedule", response_model=list[AssembledElement])
async def get_assembled_schedule(
    file_id: str,
    ifc_type: Optional[str] = Query(None),
    storey: Optional[str] = Query(None),
    external_only: bool = Query(False),
):
    """Return elements with derived assembly components applied.

    Supports the same filters as /quantities. Elements with no matching
    assemblies are still returned (with an empty components list).
    """
    records = _get_elements(file_id)

    if ifc_type:
        records = [r for r in records if r.ifc_type == ifc_type]
    if storey:
        records = [r for r in records if r.storey == storey]
    if external_only:
        records = [r for r in records if r.is_external]

    return apply_assemblies(records)


@router.get("/files/{file_id}/bom")
async def get_bom(file_id: str):
    """Return a rolled-up Bill of Materials — all assembly components summed by item.

    Useful for a quick overview of total material quantities across the model.
    """
    records = _get_elements(file_id)
    assembled = apply_assemblies(records)
    return bom_summary(assembled)


@router.get("/files/{file_id}/export/xlsx-full")
async def export_xlsx_full(file_id: str):
    """XLSX export with Schedule, By Type, By Storey, Components, and Bill of Materials sheets."""
    records = _get_elements(file_id)
    assembled = apply_assemblies(records)
    xlsx_bytes = to_xlsx_assembled(records, assembled)
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=full_schedule_{file_id}.xlsx"},
    )


@router.post("/assembly-library/reload", status_code=200)
async def reload_assembly_library():
    """Reload the assembly_library.json without restarting the container."""
    reload_library()
    return {"status": "reloaded"}


_ASSEMBLY_LIB_PATH = Path(__file__).parent.parent / "assembly_library.json"


@router.get("/assembly-library")
async def get_assembly_library():
    """Return the full assembly library JSON."""
    try:
        with open(_ASSEMBLY_LIB_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Assembly library not found")


@router.put("/assembly-library", status_code=200)
async def update_assembly_library(body: dict):
    """Save an updated assembly library and hot-reload it.

    Body must be the full library object containing an 'assemblies' list.
    """
    if "assemblies" not in body or not isinstance(body["assemblies"], list):
        raise HTTPException(status_code=422, detail="Body must contain an 'assemblies' list")
    with open(_ASSEMBLY_LIB_PATH, "w", encoding="utf-8") as fh:
        json.dump(body, fh, indent=2, ensure_ascii=False)
    reload_library()
    return {"status": "saved", "count": len(body["assemblies"])}


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _extract_geometry(path, progress_cb=None) -> list[dict]:
    """Extract geometry from an IFC file, optionally reporting progress."""
    from app.core.extractor import TARGET_TYPES

    ifc = ifcopenshell.open(str(path))
    if progress_cb:
        progress_cb(10, "Collecting elements…")

    geo_settings = ifcopenshell.geom.settings()
    geo_settings.set(geo_settings.USE_WORLD_COORDS, True)
    geo_settings.set(geo_settings.WELD_VERTICES, True)

    seen_ids: set[int] = set()
    elements = []
    for ifc_type in TARGET_TYPES:
        try:
            for el in ifc.by_type(ifc_type, include_subtypes=True):
                if el.id() not in seen_ids:
                    seen_ids.add(el.id())
                    elements.append(el)
        except Exception:
            pass  # Type not in this schema (e.g. IFC4-only type in IFC2X3 file)

    if not elements:
        return []

    total = len(elements)
    if progress_cb:
        progress_cb(15, f"Processing {total} elements…")

    meshes: list[dict] = []
    elements_set: set | None = None
    try:
        it = ifcopenshell.geom.iterator(geo_settings, ifc, include=elements)
        has_items = it.initialize()
    except Exception:
        it = ifcopenshell.geom.iterator(geo_settings, ifc)
        has_items = it.initialize()
        elements_set = {e.GlobalId for e in elements}

    if not has_items:
        return []

    done = 0
    while True:
        shape = it.get()
        if elements_set is None or shape.guid in elements_set:
            geo = shape.geometry
            ifc_type = shape.product.is_a()
            meshes.append({
                "guid":    shape.guid,
                "type":    ifc_type,
                "name":    getattr(shape.product, "Name", "") or "",
                "verts":   list(geo.verts),
                "faces":   list(geo.faces),
                "color":   list(_TYPE_COLORS.get(ifc_type, _DEFAULT_COLOR)),
                "opacity": 0.35 if ifc_type in _TRANSPARENT_TYPES else 1.0,
            })
            done += 1
            if progress_cb and total > 0:
                pct = 15 + int((done / total) * 80)
                if done % max(1, total // 20) == 0:   # report ~20 times
                    progress_cb(pct, f"Processing {done}/{total} elements…")
        if not it.next():
            break

    return meshes


# ── Geometry — SSE extraction progress ───────────────────────────────────────

@router.get("/files/{file_id}/geometry/extract")
async def extract_geometry_progress(file_id: str):
    """SSE stream that drives geometry extraction and reports progress.

    The client connects here first; on receiving stage=complete or stage=cached
    it fetches /geometry to get the actual mesh data.
    """
    async def event_stream():
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        # Memory cache hit
        if file_id in _geometry_cache:
            n = len(_geometry_cache[file_id])
            yield sse({"stage": "cached", "percent": 100, "message": f"Loaded {n} meshes from cache"})
            return

        # Disk cache hit
        cached = cache_store.load_geometry_cache(file_id, version=_GEOMETRY_CACHE_VERSION)
        if cached is not None:
            _geometry_cache[file_id] = cached
            yield sse({"stage": "cached", "percent": 100, "message": f"Loaded {len(cached)} meshes from cache"})
            return

        path = file_store.get_path(file_id)
        if path is None:
            yield sse({"stage": "error", "message": f"File '{file_id}' not found"})
            return

        q: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def push(pct: int, msg: str) -> None:
            loop.call_soon_threadsafe(q.put_nowait, {"percent": pct, "message": msg})

        def do_work() -> None:
            try:
                push(5, "Opening IFC file…")
                meshes = _extract_geometry(path, progress_cb=push)
                _geometry_cache[file_id] = meshes
                push(97, "Saving to disk cache…")
                cache_store.save_geometry_cache(file_id, meshes, version=_GEOMETRY_CACHE_VERSION)
                loop.call_soon_threadsafe(q.put_nowait, {
                    "stage": "complete",
                    "percent": 100,
                    "message": f"Done — {len(meshes)} meshes",
                })
            except Exception as exc:
                loop.call_soon_threadsafe(q.put_nowait, {"stage": "error", "message": str(exc)})

        future = loop.run_in_executor(None, do_work)

        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=300.0)
                yield sse(item)
                if item.get("stage") in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                yield sse({"percent": -1, "message": "Still extracting…"})

        await future

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Geometry — fetch cached result ────────────────────────────────────────────

@router.get("/files/{file_id}/geometry")
async def get_geometry(file_id: str):
    """Return cached geometry meshes. Call /geometry/extract first to populate."""
    if file_id in _geometry_cache:
        return JSONResponse(content=_geometry_cache[file_id])

    # Try disk cache (survives restarts)
    cached = cache_store.load_geometry_cache(file_id, version=_GEOMETRY_CACHE_VERSION)
    if cached is not None:
        _geometry_cache[file_id] = cached
        return JSONResponse(content=cached)

    raise HTTPException(
        status_code=404,
        detail="Geometry not yet extracted — call /geometry/extract first",
    )
