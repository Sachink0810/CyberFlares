"""
Dam registry endpoints. Feed the frontend map with clickable pins.
"""
from fastapi import APIRouter, HTTPException
from ..services.hydrology.dam_registry import list_dams, get_dam

router = APIRouter(prefix="/dams", tags=["dams"])


@router.get("")
def list_all_dams():
    """All known dams in the seed registry."""
    return list_dams()


@router.get("/{dam_id}")
def get_dam_by_id(dam_id: str):
    """One dam by id — used when a user clicks a pin on the map."""
    dam = get_dam(dam_id)
    if not dam:
        raise HTTPException(404, f"dam '{dam_id}' not found")
    return dam
