"""Core IFC quantity extraction engine.

Extraction order (per CLAUDE.md):
1. IsDefinedBy → IfcElementQuantity (BaseQuantities) — source: "authored"
2. IsDefinedBy → IfcPropertySet for Pset properties
3. HasAssociations for material data
4. Fallback to ifcopenshell.geom bounding box — source: "estimated"
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Optional

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element as ifc_util

from app.core.units import (
    UnitConfig, detect_units,
    normalise, normalise_length, normalise_area, normalise_volume,
)
from app.models.schemas import QuantityRecord, QuantityValues

logger = logging.getLogger(__name__)

TARGET_TYPES = [
    "IfcWall", "IfcWallStandardCase",
    "IfcSlab", "IfcRoof",
    "IfcBeam", "IfcColumn",
    "IfcDoor", "IfcWindow",
    "IfcStair", "IfcRailing",
    "IfcCovering", "IfcCurtainWall",
]


# ── Type lookup ───────────────────────────────────────────────────────────────

def _build_type_map(ifc_file: ifcopenshell.file) -> dict[str, tuple[str, str]]:
    """Map element GlobalId → (type_name, type_class) from IfcRelDefinesByType."""
    type_map: dict[str, tuple[str, str]] = {}
    for rel in ifc_file.by_type("IfcRelDefinesByType"):
        t = rel.RelatingType
        type_name = (t.Name or "").strip() or None
        type_class = t.is_a()
        if type_name:
            for obj in rel.RelatedObjects:
                type_map[obj.GlobalId] = (type_name, type_class)
    return type_map


# ── Storey lookup ──────────────────────────────────────────────────────────────

def _build_storey_map(ifc_file: ifcopenshell.file) -> dict[str, str]:
    """Map element GlobalId → storey name."""
    storey_map: dict[str, str] = {}
    for rel in ifc_file.by_type("IfcRelContainedInSpatialStructure"):
        structure = rel.RelatingStructure
        storey_name = (
            structure.Name
            if hasattr(structure, "Name") and structure.Name
            else "Unknown"
        )
        if structure.is_a("IfcBuildingStorey"):
            for element in rel.RelatedElements:
                storey_map[element.GlobalId] = storey_name
    return storey_map


# ── Material extraction ───────────────────────────────────────────────────────

def _get_material(element) -> Optional[str]:
    try:
        for rel in element.HasAssociations:
            if rel.is_a("IfcRelAssociatesMaterial"):
                mat = rel.RelatingMaterial
                if mat.is_a("IfcMaterial"):
                    return mat.Name
                if mat.is_a("IfcMaterialLayerSetUsage"):
                    return mat.ForLayerSet.LayerSetName or None
                if mat.is_a("IfcMaterialLayerSet"):
                    return mat.LayerSetName or None
                if mat.is_a("IfcMaterialList"):
                    names = [m.Name for m in mat.Materials if m.Name]
                    return ", ".join(names) if names else None
    except AttributeError:
        pass
    return None


# ── Property set extraction ────────────────────────────────────────────────────

def _get_pset_properties(element) -> dict[str, Any]:
    props: dict[str, Any] = {}
    try:
        for rel in element.IsDefinedBy:
            if rel.is_a("IfcRelDefinesByProperties"):
                defn = rel.RelatingPropertyDefinition
                if defn.is_a("IfcPropertySet"):
                    for prop in defn.HasProperties:
                        if prop.is_a("IfcPropertySingleValue") and prop.NominalValue:
                            props[prop.Name] = prop.NominalValue.wrappedValue
    except AttributeError:
        pass
    return props


def _is_external(element, props: dict[str, Any]) -> bool:
    for key in ("IsExternal", "is_external", "External"):
        if key in props:
            val = props[key]
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() in ("true", "yes", "1")
    return False


# ── BaseQuantity extraction ────────────────────────────────────────────────────

# Length quantity names worth capturing (broad — catches Length, NominalLength, etc.)
_LENGTH_NAMES = {"length", "nominallength", "overalllength", "height", "depth", "span"}


def _get_base_quantities(element, units: UnitConfig) -> Optional[QuantityValues]:
    """Walk all IfcElementQuantity sets and normalise using per-dimension units."""
    qty: dict[str, Optional[float]] = {}
    try:
        for rel in element.IsDefinedBy:
            if rel.is_a("IfcRelDefinesByProperties"):
                defn = rel.RelatingPropertyDefinition
                if not defn.is_a("IfcElementQuantity"):
                    continue
                for q in defn.Quantities:
                    name = (q.Name or "").lower()
                    if q.is_a("IfcQuantityLength"):
                        # Take the first length-ish quantity we haven't captured yet
                        if "length" not in qty and any(k in name for k in _LENGTH_NAMES):
                            qty["length"] = normalise_length(q.LengthValue, units.length)
                    elif q.is_a("IfcQuantityArea"):
                        # Prefer net; accept any first area
                        if "net" in name or "area" not in qty:
                            qty["area"] = normalise_area(q.AreaValue, units.area)
                    elif q.is_a("IfcQuantityVolume"):
                        # Prefer net; accept any first volume
                        if "net" in name or "volume" not in qty:
                            qty["volume"] = normalise_volume(q.VolumeValue, units.volume)
                    elif q.is_a("IfcQuantityWeight"):
                        if "weight" not in qty:
                            qty["weight"] = q.WeightValue
    except AttributeError:
        pass

    if not qty:
        return None

    return QuantityValues(
        length=qty.get("length"),
        area=qty.get("area"),
        volume=qty.get("volume"),
        count=1,
        weight=qty.get("weight"),
        source="authored",
    )


# ── Geometry fallback ──────────────────────────────────────────────────────────


def _geometry_fallback(element, length_unit: str) -> QuantityValues:
    """Estimate quantities from bounding box via ifcopenshell.geom."""
    try:
        shape = ifcopenshell.geom.create_shape(_GEOM_SETTINGS, element)
        verts = shape.geometry.verts  # flat list: x0,y0,z0, x1,y1,z1, ...
        xs = verts[0::3]
        ys = verts[1::3]
        zs = verts[2::3]
        dx = normalise(max(xs) - min(xs), length_unit, 1) or 0
        dy = normalise(max(ys) - min(ys), length_unit, 1) or 0
        dz = normalise(max(zs) - min(zs), length_unit, 1) or 0
        return QuantityValues(
            length=max(dx, dy, dz),
            area=dx * dy,
            volume=dx * dy * dz,
            count=1,
            source="estimated",
        )
    except Exception:
        return QuantityValues(count=1, source="estimated")


def _geom_fallback_worker(args) -> tuple[str, QuantityValues]:
    element, length_unit = args
    return element.GlobalId, _geometry_fallback(element, length_unit)


def _needs_geom_supplement(qty: Optional[QuantityValues]) -> bool:
    """True when area AND volume are both missing — worth running geometry."""
    if qty is None:
        return True
    return qty.area is None and qty.volume is None


# ── Main extraction ────────────────────────────────────────────────────────────

ProgressCb = Callable[[int, str], None]


def extract_elements(
    ifc_file: ifcopenshell.file,
    progress_cb: Optional[ProgressCb] = None,
) -> list[QuantityRecord]:

    def report(pct: int, msg: str) -> None:
        if progress_cb:
            progress_cb(pct, msg)

    report(20, "Detecting units and building spatial index…")
    units = detect_units(ifc_file)
    storey_map = _build_storey_map(ifc_file)
    type_map = _build_type_map(ifc_file)

    elements_needing_geom: list[tuple] = []
    records: dict[str, QuantityRecord] = {}

    n_types = len(TARGET_TYPES)
    for i, ifc_type in enumerate(TARGET_TYPES):
        elements = ifc_file.by_type(ifc_type)
        pct = 25 + int((i / n_types) * 50)  # 25 → 75 %
        if elements:
            report(pct, f"Extracting {ifc_type} ({len(elements)} element{'s' if len(elements) != 1 else ''})…")

        for element in elements:
            guid = element.GlobalId
            props = _get_pset_properties(element)
            quantities = _get_base_quantities(element, units)

            had_base = quantities is not None
            if not had_base:
                quantities = QuantityValues(count=1, source="estimated")

            if _needs_geom_supplement(quantities if had_base else None):
                elements_needing_geom.append((element, units.length, had_base))

            type_info = type_map.get(guid)
            records[guid] = QuantityRecord(
                guid=guid,
                ifc_type=element.is_a(),
                name=element.Name or "",
                type_name=type_info[0] if type_info else None,
                type_class=type_info[1] if type_info else None,
                storey=storey_map.get(guid, "Unknown"),
                is_external=_is_external(element, props),
                material=_get_material(element),
                quantities=quantities,
                properties=props,
            )

    # Geometry fallback
    if elements_needing_geom:
        n = len(elements_needing_geom)
        report(76, f"Running geometry fallback for {n} element{'s' if n != 1 else ''}…")
        logger.info("Running geometry fallback for %d elements", n)
        done = 0
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {
                pool.submit(_geom_fallback_worker, (el, lu)): (el.GlobalId, had_base)
                for el, lu, had_base in elements_needing_geom
            }
            for future in as_completed(futures):
                guid, had_base = futures[future]
                done += 1
                if done % max(1, n // 10) == 0:
                    pct = 76 + int((done / n) * 18)  # 76 → 94 %
                    report(pct, f"Geometry fallback: {done}/{n}…")
                try:
                    _, geom_qty = future.result()
                    if guid not in records:
                        continue
                    existing = records[guid].quantities
                    if had_base:
                        merged = existing.model_copy(update={
                            "area":   existing.area   if existing.area   is not None else geom_qty.area,
                            "volume": existing.volume if existing.volume is not None else geom_qty.volume,
                            "length": existing.length if existing.length is not None else geom_qty.length,
                            "source": "authored" if (existing.area is not None or existing.volume is not None) else "estimated",
                        })
                    else:
                        merged = geom_qty
                    records[guid] = records[guid].model_copy(update={"quantities": merged})
                except Exception as exc:
                    logger.warning("Geometry fallback failed for %s: %s", guid, exc)

    report(95, "Finalising…")
    return list(records.values())
