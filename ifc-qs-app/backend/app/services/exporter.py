"""CSV and XLSX export from quantity records."""
from __future__ import annotations

import io
from typing import Any

import pandas as pd

from app.models.schemas import AssembledElement, QuantityRecord


def _records_to_df(records: list[QuantityRecord]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for r in records:
        rows.append(
            {
                "guid": r.guid,
                "ifc_type": r.ifc_type,
                "name": r.name,
                "type_name": r.type_name or "",
                "storey": r.storey,
                "is_external": r.is_external,
                "material": r.material or "",
                "length_m": r.quantities.length,
                "area_m2": r.quantities.area,
                "volume_m3": r.quantities.volume,
                "count": r.quantities.count,
                "weight_kg": r.quantities.weight,
                "qty_source": r.quantities.source,
            }
        )
    return pd.DataFrame(rows)


def to_csv(records: list[QuantityRecord]) -> bytes:
    df = _records_to_df(records)
    return df.to_csv(index=False).encode("utf-8")


def to_xlsx(records: list[QuantityRecord]) -> bytes:
    df = _records_to_df(records)

    by_type = (
        df.groupby("ifc_type")
        .agg(
            total_area_m2=("area_m2", "sum"),
            total_volume_m3=("volume_m3", "sum"),
            total_length_m=("length_m", "sum"),
            count=("count", "sum"),
        )
        .reset_index()
    )

    by_storey = (
        df.groupby("storey")
        .agg(
            total_area_m2=("area_m2", "sum"),
            total_volume_m3=("volume_m3", "sum"),
            total_length_m=("length_m", "sum"),
            count=("count", "sum"),
        )
        .reset_index()
    )

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Schedule", index=False)
        by_type.to_excel(writer, sheet_name="By Type", index=False)
        by_storey.to_excel(writer, sheet_name="By Storey", index=False)

    return buf.getvalue()


def _components_to_df(assembled: list[AssembledElement]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for el in assembled:
        for comp in el.components:
            rows.append({
                "element_guid": el.guid,
                "element_type": el.ifc_type,
                "element_name": el.name,
                "storey": el.storey,
                "assembly": comp.assembly_label,
                "code": comp.code or "",
                "component": comp.name,
                "unit": comp.unit,
                "quantity": comp.quantity,
                "notes": comp.notes or "",
            })
    return pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["element_guid", "element_type", "element_name", "storey",
                 "assembly", "code", "component", "unit", "quantity", "notes"]
    )


def _bom_to_df(assembled: list[AssembledElement]) -> pd.DataFrame:
    from app.services.assembler import bom_summary
    rows = bom_summary(assembled)
    return pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["code", "name", "unit", "total_quantity", "assemblies"]
    )


def to_xlsx_assembled(
    records: list[QuantityRecord],
    assembled: list[AssembledElement],
) -> bytes:
    """5-sheet XLSX: Schedule, By Type, By Storey, Components, Bill of Materials."""
    df = _records_to_df(records)

    by_type = (
        df.groupby("ifc_type")
        .agg(
            total_area_m2=("area_m2", "sum"),
            total_volume_m3=("volume_m3", "sum"),
            total_length_m=("length_m", "sum"),
            count=("count", "sum"),
        )
        .reset_index()
    )

    by_storey = (
        df.groupby("storey")
        .agg(
            total_area_m2=("area_m2", "sum"),
            total_volume_m3=("volume_m3", "sum"),
            total_length_m=("length_m", "sum"),
            count=("count", "sum"),
        )
        .reset_index()
    )

    comp_df = _components_to_df(assembled)
    bom_df = _bom_to_df(assembled)

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Schedule", index=False)
        by_type.to_excel(writer, sheet_name="By Type", index=False)
        by_storey.to_excel(writer, sheet_name="By Storey", index=False)
        comp_df.to_excel(writer, sheet_name="Components", index=False)
        bom_df.to_excel(writer, sheet_name="Bill of Materials", index=False)

    return buf.getvalue()
