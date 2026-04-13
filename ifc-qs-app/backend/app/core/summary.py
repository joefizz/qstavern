"""Extract high-level model metadata from an open IFC file."""
from __future__ import annotations

import ifcopenshell

from app.models.schemas import ModelSummary

TARGET_TYPES = [
    "IfcWall", "IfcWallStandardCase",
    "IfcSlab", "IfcRoof",
    "IfcBeam", "IfcColumn",
    "IfcDoor", "IfcWindow",
    "IfcStair", "IfcRailing",
    "IfcCovering", "IfcCurtainWall",
]


def get_project_name(ifc_file: ifcopenshell.file) -> str:
    try:
        return ifc_file.by_type("IfcProject")[0].Name or "Unnamed Project"
    except (IndexError, AttributeError):
        return "Unnamed Project"


def get_storeys(ifc_file: ifcopenshell.file) -> list[str]:
    return [
        s.Name or f"Storey {i}"
        for i, s in enumerate(ifc_file.by_type("IfcBuildingStorey"))
    ]


def get_element_count(ifc_file: ifcopenshell.file) -> int:
    count = 0
    for ifc_type in TARGET_TYPES:
        count += len(ifc_file.by_type(ifc_type))
    return count


def build_summary(file_id: str, ifc_file: ifcopenshell.file) -> ModelSummary:
    return ModelSummary(
        file_id=file_id,
        project_name=get_project_name(ifc_file),
        ifc_schema=ifc_file.schema,
        storeys=get_storeys(ifc_file),
        element_count=get_element_count(ifc_file),
    )
