"""
Near-real-time SAR flood-mapping endpoints.

Async (Celery-backed) — the engine can take minutes for a large AOI.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..core import job_store

router = APIRouter(prefix="/nrt", tags=["nrt-sar"])


class SARFloodRequest(BaseModel):
    project_id: str = Field(..., description="GCP project with Earth Engine enabled")
    event_name: str = Field(..., min_length=1, max_length=64)
    center_lat: float = Field(..., ge=-90, le=90)
    center_lon: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(..., gt=0, le=100)
    start_date: str = Field(..., description="YYYY-MM-DD, inclusive")
    end_date: str = Field(..., description="YYYY-MM-DD, inclusive")
    change_detection: bool = False
    pass_direction: str = "AUTO"
    polarisation: str = "VV"


@router.post("/sar")
def start_sar_analysis(req: SARFloodRequest):
    """
    Queue an NRT SAR flood-mapping job for one AOI + date window.
    Returns the job id — poll ``GET /nrt/sar/{id}`` for state.
    """
    job_id = "nrt-" + uuid.uuid4().hex[:10]
    job_store.create(job_id, {"request": req.model_dump()})

    # Import lazily so the API doesn't crash if earthengine-api is missing.
    from ..tasks.nrt_sar import run_nrt_sar
    run_nrt_sar.delay(job_id)

    return job_store.get(job_id)


@router.get("/sar/{job_id}")
def poll_sar(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


@router.get("/sar/{job_id}/download/{artifact}")
def download_sar_artifact(job_id: str, artifact: str):
    """
    ``artifact`` is one of: ``geojson`` | ``shp`` | ``kml`` | ``html`` | ``manifest``.
    """
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    path = job.get("artifacts", {}).get(artifact)
    if not path or not Path(path).exists():
        raise HTTPException(404, f"artifact '{artifact}' not available for this job")
    return FileResponse(path, filename=Path(path).name)
