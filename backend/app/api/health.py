from fastapi import APIRouter
from ..core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "sph_mode": settings.sph_mode,
        "data_dir": str(settings.data_dir),
    }
