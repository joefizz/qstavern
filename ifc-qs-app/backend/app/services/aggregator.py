"""Build aggregate summaries from extracted element records."""
from __future__ import annotations

from typing import Literal

from app.models.schemas import AggregateRow, QuantityRecord


def aggregate(
    records: list[QuantityRecord],
    group_by: Literal["ifc_type", "storey"],
) -> list[AggregateRow]:
    buckets: dict[str, dict] = {}

    for r in records:
        key = r.ifc_type if group_by == "ifc_type" else r.storey
        if key not in buckets:
            buckets[key] = {"area": 0.0, "volume": 0.0, "length": 0.0, "count": 0}
        b = buckets[key]
        b["count"] += r.quantities.count
        if r.quantities.area is not None:
            b["area"] += r.quantities.area
        if r.quantities.volume is not None:
            b["volume"] += r.quantities.volume
        if r.quantities.length is not None:
            b["length"] += r.quantities.length

    def _none_if_zero(v: float) -> float | None:
        return v if v != 0.0 else None

    return [
        AggregateRow(
            group_by=group_by,
            group_value=key,
            total_area=_none_if_zero(vals["area"]),
            total_volume=_none_if_zero(vals["volume"]),
            total_length=_none_if_zero(vals["length"]),
            count=vals["count"],
        )
        for key, vals in buckets.items()
    ]
