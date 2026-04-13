"""Generate minimal IFC fixture files for testing.

Run once inside the container:
    python tests/fixtures/generate_fixtures.py

Produces:
    tests/fixtures/sample_ifc2x3.ifc
    tests/fixtures/sample_ifc4.ifc
"""
from pathlib import Path
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.api.root
import ifcopenshell.api.unit
import ifcopenshell.api.context
import ifcopenshell.api.project
import ifcopenshell.api.spatial
import ifcopenshell.api.element
import ifcopenshell.api.geometry

HERE = Path(__file__).parent


def _make_model(schema: str, output_path: Path):
    model = ifcopenshell.api.run("project.create_file", version=schema)

    project = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcProject", name="Test Project"
    )
    ifcopenshell.api.run("unit.assign_si_units", model, length="METRE")

    site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite", name="Site")
    building = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcBuilding", name="Building"
    )
    storey = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcBuildingStorey", name="Level 1"
    )

    ifcopenshell.api.run("aggregate.assign_object", model, product=site, relating_object=project)
    ifcopenshell.api.run(
        "aggregate.assign_object", model, product=building, relating_object=site
    )
    ifcopenshell.api.run(
        "aggregate.assign_object", model, product=storey, relating_object=building
    )

    wall = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcWall", name="Test Wall"
    )
    ifcopenshell.api.run(
        "spatial.assign_container", model, product=wall, relating_structure=storey
    )

    # Add a simple element quantity
    qset = model.createIfcElementQuantity(
        GlobalId=ifcopenshell.guid.new(),
        Name="BaseQuantities",
        Quantities=[
            model.createIfcQuantityArea(Name="NetSideArea", AreaValue=10.0),
            model.createIfcQuantityVolume(Name="NetVolume", VolumeValue=2.5),
            model.createIfcQuantityLength(Name="Length", LengthValue=5.0),
        ],
    )
    model.createIfcRelDefinesByProperties(
        GlobalId=ifcopenshell.guid.new(),
        RelatedObjects=[wall],
        RelatingPropertyDefinition=qset,
    )

    model.write(str(output_path))
    print(f"Written: {output_path}")


if __name__ == "__main__":
    HERE.mkdir(parents=True, exist_ok=True)
    _make_model("IFC2X3", HERE / "sample_ifc2x3.ifc")
    _make_model("IFC4", HERE / "sample_ifc4.ifc")
    print("Done.")
