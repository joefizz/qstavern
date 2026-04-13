"""Unit detection and normalisation for IFC files.

IFC files can declare different units per dimension. ArchiCAD (a common export
tool) stores lengths in mm but areas in m² and volumes in m³.  We detect each
dimension's unit separately so we always output SI: m / m² / m³.
"""
from __future__ import annotations
from typing import Optional


class UnitConfig:
    def __init__(self, length: str = "m", area: str = "m2", volume: str = "m3"):
        self.length = length   # "m" or "mm"
        self.area = area       # "m2" or "mm2"
        self.volume = volume   # "m3" or "mm3"


def detect_units(ifc_file) -> UnitConfig:
    """Read IfcUnitAssignment and return per-dimension unit strings."""
    cfg = UnitConfig()
    try:
        project = ifc_file.by_type("IfcProject")[0]
        unit_assignment = project.UnitsInContext
        if unit_assignment is None:
            return cfg
        for unit in unit_assignment.Units:
            if not hasattr(unit, "UnitType"):
                continue
            prefix = getattr(unit, "Prefix", None)
            is_milli = prefix == "MILLI"
            if unit.UnitType == "LENGTHUNIT":
                cfg.length = "mm" if is_milli else "m"
            elif unit.UnitType == "AREAUNIT":
                cfg.area = "mm2" if is_milli else "m2"
            elif unit.UnitType == "VOLUMEUNIT":
                cfg.volume = "mm3" if is_milli else "m3"
    except (IndexError, AttributeError):
        pass
    return cfg


# Keep the old single-value helper so existing callers don't break
def detect_length_unit(ifc_file) -> str:
    return detect_units(ifc_file).length


def normalise_length(value: Optional[float], unit: str) -> Optional[float]:
    if value is None:
        return None
    return value / 1_000 if unit == "mm" else value


def normalise_area(value: Optional[float], unit: str) -> Optional[float]:
    if value is None:
        return None
    return value / 1_000_000 if unit == "mm2" else value


def normalise_volume(value: Optional[float], unit: str) -> Optional[float]:
    if value is None:
        return None
    return value / 1_000_000_000 if unit == "mm3" else value


# Legacy helper used by geometry fallback (bounding box coords follow length unit)
def normalise(value: Optional[float], length_unit: str, power: int = 1) -> Optional[float]:
    if value is None:
        return None
    if length_unit == "mm":
        return value / (1_000 ** power)
    return value
