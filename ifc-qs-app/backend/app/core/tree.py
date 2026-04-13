"""Build a spatial hierarchy tree from an IFC file.

Output: nested TreeNode dicts walking the IfcRelAggregates decomposition
from IfcProject down, with contained elements attached at their storey.
"""
from __future__ import annotations

from typing import Any

import ifcopenshell


def _node(entity) -> dict[str, Any]:
    return {
        "guid": entity.GlobalId if hasattr(entity, "GlobalId") else None,
        "type": entity.is_a(),
        "name": (entity.Name or "") if hasattr(entity, "Name") else "",
        "children": [],
    }


def _attach_contained_elements(storey_node: dict, storey, ifc_file: ifcopenshell.file):
    """Add directly-contained elements to a storey node."""
    for rel in ifc_file.by_type("IfcRelContainedInSpatialStructure"):
        if rel.RelatingStructure == storey:
            for el in rel.RelatedElements:
                child = _node(el)
                # Walk IfcRelDecomposes for openings, fills, etc.
                for sub_rel in getattr(el, "IsDecomposedBy", []):
                    for part in getattr(sub_rel, "RelatedObjects", []):
                        child["children"].append(_node(part))
                storey_node["children"].append(child)


def _build_spatial_children(spatial_entity, ifc_file: ifcopenshell.file) -> list[dict]:
    children: list[dict] = []
    for rel in ifc_file.by_type("IfcRelAggregates"):
        if rel.RelatingObject == spatial_entity:
            for child_entity in rel.RelatedObjects:
                child_node = _node(child_entity)
                # Recurse into spatial children (buildings, storeys)
                child_node["children"] = _build_spatial_children(child_entity, ifc_file)
                # Attach elements at this level if it's a storey or space
                if child_entity.is_a("IfcBuildingStorey") or child_entity.is_a("IfcSpace"):
                    _attach_contained_elements(child_node, child_entity, ifc_file)
                children.append(child_node)
    return children


def build_tree(ifc_file: ifcopenshell.file) -> dict[str, Any]:
    """Return a single root node representing the IfcProject."""
    try:
        project = ifc_file.by_type("IfcProject")[0]
    except IndexError:
        return {"guid": None, "type": "IfcProject", "name": "Unknown", "children": []}

    root = _node(project)
    root["children"] = _build_spatial_children(project, ifc_file)
    return root
