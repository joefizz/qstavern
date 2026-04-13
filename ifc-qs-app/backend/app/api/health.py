from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    try:
        import ifcopenshell
        ifc_version = ifcopenshell.version
    except Exception:
        ifc_version = "unavailable"

    return {"status": "ok", "ifcopenshell_version": ifc_version}
