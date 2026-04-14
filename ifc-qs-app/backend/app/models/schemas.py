from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    size_bytes: int


# ── Summary ───────────────────────────────────────────────────────────────────

class ModelSummary(BaseModel):
    file_id: str
    project_name: str
    ifc_schema: str      # e.g. "IFC2X3" or "IFC4"
    storeys: list[str]
    element_count: int


# ── Quantities ────────────────────────────────────────────────────────────────

class QuantityRecord(BaseModel):
    guid: str
    ifc_type: str
    name: str
    type_name: Optional[str]      # from IfcRelDefinesByType (e.g. "CONCRETE 155")
    type_class: Optional[str]     # e.g. "IfcWallType", "IfcColumnType"
    storey: str
    is_external: bool
    material: Optional[str]
    quantities: QuantityValues
    properties: dict[str, Any]


class QuantityValues(BaseModel):
    # Canonical fields — used by assembly formula engine
    length: Optional[float] = None   # primary run / span (m)
    area: Optional[float] = None     # net or primary area (m²)
    volume: Optional[float] = None   # net or primary volume (m³)
    count: int = 1
    weight: Optional[float] = None   # kg
    source: str  # "authored" | "estimated"
    # All IFC-authored quantities with original names, normalised to m / m² / m³ / kg
    all_quantities: dict[str, float] = {}


# ── File library ──────────────────────────────────────────────────────────────

class FileRecord(BaseModel):
    file_id: str
    filename: str
    size_bytes: int
    uploaded_at: str          # ISO-8601 string
    is_processed: bool        # True if element cache exists on disk


# ── Assembly Library ──────────────────────────────────────────────────────────

class AssemblyComponentResult(BaseModel):
    """A single sub-component derived from a matched assembly recipe."""
    assembly_id: str
    assembly_label: str
    code: Optional[str]
    name: str
    unit: str
    quantity: float
    notes: Optional[str] = None


class AssembledElement(BaseModel):
    """A QuantityRecord with zero or more derived assembly components attached."""
    guid: str
    ifc_type: str
    name: str
    type_name: Optional[str]
    type_class: Optional[str]
    storey: str
    is_external: bool
    material: Optional[str]
    quantities: QuantityValues
    properties: dict[str, Any]
    components: list[AssemblyComponentResult]


# ── Aggregates ────────────────────────────────────────────────────────────────

class AggregateRow(BaseModel):
    group_by: str
    group_value: str
    total_area: Optional[float]
    total_volume: Optional[float]
    total_length: Optional[float]
    count: int
