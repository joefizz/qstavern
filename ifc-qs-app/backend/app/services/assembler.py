"""Assembly Library — matches IFC elements to component recipes and evaluates quantities.

Usage:
    from app.services.assembler import apply_assemblies
    assembled = apply_assemblies(records)

Each element may match zero or more assemblies. All matching assemblies apply
(their components are concatenated). Design recipes to be non-overlapping where
mutual exclusion is needed (e.g. use is_external: true/false to split door types).
"""
from __future__ import annotations

import ast
import json
import math
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.models.schemas import AssemblyComponentResult, AssembledElement, QuantityRecord

logger = logging.getLogger(__name__)

_LIBRARY_PATH = Path(__file__).parent.parent / "assembly_library.json"

# ── Safe formula evaluator ────────────────────────────────────────────────────

_ALLOWED_AST_NODES = frozenset({
    ast.Expression,
    ast.BinOp, ast.UnaryOp,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.UAdd, ast.USub,
    ast.Constant,
    ast.Name,
    ast.Call,
    ast.Load,
})

_ALLOWED_FUNCTIONS: dict[str, Any] = {
    "round": round,
    "ceil": math.ceil,
    "floor": math.floor,
    "max": max,
    "min": min,
}

# Variable names that may appear in formulas
_FORMULA_VARS = frozenset({"area", "length", "volume", "count", "weight"})
_ALLOWED_NAMES = _FORMULA_VARS | frozenset(_ALLOWED_FUNCTIONS.keys())


def _safe_eval(formula: str, context: dict[str, float]) -> float:
    """Evaluate a formula string against a variable context.

    Only arithmetic operations and the whitelisted functions/names are allowed.
    Raises ValueError for any disallowed AST node or unknown name.
    """
    try:
        tree = ast.parse(formula, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Formula syntax error: {exc}") from exc

    for node in ast.walk(tree):
        if type(node) not in _ALLOWED_AST_NODES:
            raise ValueError(
                f"Disallowed expression type '{type(node).__name__}' in formula: {formula!r}"
            )
        if isinstance(node, ast.Name) and node.id not in _ALLOWED_NAMES:
            raise ValueError(f"Unknown name '{node.id}' in formula: {formula!r}")
        if isinstance(node, ast.Call):
            # Only allow direct calls to whitelisted function names
            if not (isinstance(node.func, ast.Name) and node.func.id in _ALLOWED_FUNCTIONS):
                raise ValueError(f"Disallowed function call in formula: {formula!r}")

    namespace = {**_ALLOWED_FUNCTIONS, **context, "__builtins__": {}}
    try:
        result = eval(compile(tree, "<formula>", "eval"), namespace)  # noqa: S307
        return float(result)
    except Exception as exc:
        raise ValueError(f"Formula evaluation failed for {formula!r}: {exc}") from exc


# ── Library loading ───────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_library() -> list[dict]:
    """Load and cache the assembly library JSON. Cached for the process lifetime."""
    try:
        with open(_LIBRARY_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        assemblies = data.get("assemblies", [])
        logger.info("Assembly library loaded: %d assemblies from %s", len(assemblies), _LIBRARY_PATH)
        return assemblies
    except FileNotFoundError:
        logger.warning("Assembly library not found at %s — no assemblies will be applied", _LIBRARY_PATH)
        return []
    except Exception as exc:
        logger.error("Failed to load assembly library: %s", exc)
        return []


def reload_library() -> None:
    """Invalidate the library cache (useful after editing the JSON at runtime)."""
    _load_library.cache_clear()


# ── Matching ──────────────────────────────────────────────────────────────────

def _get_field_value(element: QuantityRecord, field: str) -> Any:
    """Extract a named field value from an element for rule evaluation."""
    _simple: dict[str, Any] = {
        "ifc_type":          element.ifc_type,
        "name":              element.name or "",
        "type_name":         element.type_name or "",
        "type_class":        element.type_class or "",
        "storey":            element.storey or "",
        "material":          element.material or "",
        "is_external":       element.is_external,
        "quantities.length": element.quantities.length or 0.0,
        "quantities.area":   element.quantities.area   or 0.0,
        "quantities.volume": element.quantities.volume or 0.0,
        "quantities.count":  float(element.quantities.count),
        "quantities.weight": element.quantities.weight or 0.0,
    }
    if field in _simple:
        return _simple[field]
    if field.startswith("properties."):
        return element.properties.get(field[len("properties."):])
    return None


def _apply_operator(actual: Any, op: str, value: Any) -> bool:
    """Apply a comparison operator between an element field value and a match value."""
    if actual is None:
        return op in ("not_equals", "not_contains", "not_in")

    # String operators (all case-insensitive)
    if op == "contains":
        return str(value).lower() in str(actual).lower()
    if op == "not_contains":
        return str(value).lower() not in str(actual).lower()
    if op == "starts_with":
        return str(actual).lower().startswith(str(value).lower())
    if op == "ends_with":
        return str(actual).lower().endswith(str(value).lower())

    # Equality — booleans compared as bool, strings case-insensitive, else direct
    if op == "equals":
        if isinstance(actual, bool) or isinstance(value, bool):
            return bool(actual) == bool(value)
        if isinstance(actual, str):
            return actual.lower() == str(value).lower()
        return actual == value
    if op == "not_equals":
        if isinstance(actual, bool) or isinstance(value, bool):
            return bool(actual) != bool(value)
        if isinstance(actual, str):
            return actual.lower() != str(value).lower()
        return actual != value

    # Membership
    if op == "in":
        return actual in (value if isinstance(value, list) else [value])
    if op == "not_in":
        return actual not in (value if isinstance(value, list) else [value])

    # Numeric comparisons
    try:
        a, v = float(actual), float(value)
        if op == "gt":  return a > v
        if op == "gte": return a >= v
        if op == "lt":  return a < v
        if op == "lte": return a <= v
    except (TypeError, ValueError):
        pass

    logger.warning("Unknown match operator %r — condition ignored", op)
    return True  # unknown operator is non-fatal: treat as passing


def _matches(element: QuantityRecord, criteria: dict) -> bool:
    """Return True if *element* satisfies ALL criteria (AND logic).

    Supports two formats — both may be present simultaneously:

    Legacy keys (backward-compatible):
        ifc_type, ifc_type_in, is_external, material_contains, type_name_contains

    Rules array (new, expressive):
        "rules": [{"field": "material", "op": "contains", "value": "timber"}, ...]

    Available fields for rules:
        ifc_type, name, type_name, type_class, storey, material, is_external
        quantities.length / .area / .volume / .count / .weight
        properties.<key>   (arbitrary Pset property)

    Available operators:
        String:  contains, not_contains, equals, not_equals, starts_with, ends_with
        Number:  equals, not_equals, gt, gte, lt, lte
        List:    in, not_in
    """
    # ── Legacy keys ────────────────────────────────────────────────────────────
    if "ifc_type" in criteria and element.ifc_type != criteria["ifc_type"]:
        return False

    if "ifc_type_in" in criteria and element.ifc_type not in criteria["ifc_type_in"]:
        return False

    if "is_external" in criteria and element.is_external != criteria["is_external"]:
        return False

    if "material_contains" in criteria:
        if criteria["material_contains"].lower() not in (element.material or "").lower():
            return False

    if "type_name_contains" in criteria:
        if criteria["type_name_contains"].lower() not in (element.type_name or "").lower():
            return False

    # ── Rules array ────────────────────────────────────────────────────────────
    for rule in criteria.get("rules", []):
        field  = rule.get("field", "")
        op     = rule.get("op", "equals")
        value  = rule.get("value")
        actual = _get_field_value(element, field)
        if not _apply_operator(actual, op, value):
            return False

    return True


# ── Component calculation ─────────────────────────────────────────────────────

def _build_context(element: QuantityRecord) -> dict[str, float]:
    q = element.quantities
    return {
        "area":   q.area   if q.area   is not None else 0.0,
        "length": q.length if q.length is not None else 0.0,
        "volume": q.volume if q.volume is not None else 0.0,
        "count":  float(q.count),
        "weight": q.weight if q.weight is not None else 0.0,
    }


def _apply_assembly(
    element: QuantityRecord,
    assembly: dict,
    context: dict[str, float],
) -> list[AssemblyComponentResult]:
    results: list[AssemblyComponentResult] = []
    for comp in assembly.get("components", []):
        formula = comp.get("formula", "0")
        try:
            qty = _safe_eval(formula, context)
        except ValueError as exc:
            logger.error(
                "Assembly '%s' component '%s': %s",
                assembly.get("id"), comp.get("name"), exc,
            )
            qty = 0.0

        results.append(
            AssemblyComponentResult(
                assembly_id=assembly["id"],
                assembly_label=assembly.get("label", assembly["id"]),
                code=comp.get("code"),
                name=comp["name"],
                unit=comp.get("unit", "nr"),
                quantity=round(qty, 4),
                notes=comp.get("notes"),
            )
        )
    return results


# ── Public API ────────────────────────────────────────────────────────────────

def apply_assemblies(records: list[QuantityRecord]) -> list[AssembledElement]:
    """Return AssembledElement list — each record enriched with matched components."""
    library = _load_library()

    assembled: list[AssembledElement] = []
    for element in records:
        context = _build_context(element)
        components: list[AssemblyComponentResult] = []

        for assembly in library:
            criteria = assembly.get("match", {})
            if _matches(element, criteria):
                components.extend(_apply_assembly(element, assembly, context))

        assembled.append(
            AssembledElement(
                guid=element.guid,
                ifc_type=element.ifc_type,
                name=element.name,
                type_name=element.type_name,
                type_class=element.type_class,
                storey=element.storey,
                is_external=element.is_external,
                material=element.material,
                quantities=element.quantities,
                properties=element.properties,
                components=components,
            )
        )

    return assembled


def bom_summary(assembled: list[AssembledElement]) -> list[dict]:
    """Roll up all components into a Bill of Materials (sorted by code/name).

    Returns list of dicts: {code, name, unit, total_quantity, assembly_label}.
    Where a component name+unit combination appears across multiple assemblies,
    quantities are summed but the assembly_label lists them all.
    """
    totals: dict[tuple[str, str], dict] = {}  # (code_or_name, unit) → row

    for element in assembled:
        for comp in element.components:
            key = (comp.code or comp.name, comp.unit)
            if key not in totals:
                totals[key] = {
                    "code": comp.code or "",
                    "name": comp.name,
                    "unit": comp.unit,
                    "total_quantity": 0.0,
                    "assembly_labels": set(),
                }
            totals[key]["total_quantity"] += comp.quantity
            totals[key]["assembly_labels"].add(comp.assembly_label)

    rows = []
    for row in sorted(totals.values(), key=lambda r: (r["code"], r["name"])):
        rows.append({
            "code": row["code"],
            "name": row["name"],
            "unit": row["unit"],
            "total_quantity": round(row["total_quantity"], 4),
            "assemblies": ", ".join(sorted(row["assembly_labels"])),
        })

    return rows
