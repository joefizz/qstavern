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
    length: Optional[float] = None
    area: Optional[float] = None
    volume: Optional[float] = None
    count: int = 1
    weight: Optional[float] = None
    source: str  # "authored" | "estimated"


# ── File library ──────────────────────────────────────────────────────────────

class FileRecord(BaseModel):
    file_id: str
    filename: str
    size_bytes: int
    uploaded_at: str          # ISO-8601 string
    is_processed: bool        # True if element cache exists on disk


# ── Aggregates ────────────────────────────────────────────────────────────────

class AggregateRow(BaseModel):
    group_by: str
    group_value: str
    total_area: Optional[float]
    total_volume: Optional[float]
    total_length: Optional[float]
    count: int
