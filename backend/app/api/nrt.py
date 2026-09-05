"""
Near-real-time SAR flood-mapping endpoints.

Two entry points:
  • Cached  — GET /nrt/sar/presets/*   (precomputed, milliseconds)
  • Live    — POST /nrt/sar             (Celery-backed, real GEE run)

Route order matters: literal preset paths are declared BEFORE the
parameterised /sar/{job_id} routes, otherwise FastAPI matches
'presets' as a job_id and returns "job not found".
"""
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from ..core import job_store
from ..core.config import settings
from ..services.gee.presets import SAR_PRESETS, get_preset

router = APIRouter(prefix="/nrt", tags=["nrt-sar"])


# ─────────────────────────────────────────────────────────────
# Cached preset helpers
# ─────────────────────────────────────────────────────────────
def _preset_dir(key: str) -> Path:
    return settings.precomputed_dir / "sar" / key


def _preset_files(key: str, event_name: str) -> dict[str, Path]:
    base = _preset_dir(key)
    return {
        "geojson":  base / f"{event_name}_flood.geojson",
        "shp":      base / f"{event_name}_flood.shp",
        "kml":      base / f"{event_name}_flood.kml",
        "html":     base / f"{event_name}_map.html",
        "manifest": base / f"{event_name}_manifest.json",
    }


@router.get("/sar/presets")
def list_sar_presets():
    """
    Every curated event. Two independent cache flags:
      * ``geojson_cached`` — vector polygons ready for overlay
      * ``html_cached``    — the engine's own interactive HTML view
    Either alone is enough to click a chip in the frontend.
    """
    out = []
    for p in SAR_PRESETS:
        files = _preset_files(p.key, p.event_name)
        entry = p.as_dict()
        entry["geojson_cached"] = files["geojson"].exists()
        entry["html_cached"]    = files["html"].exists()
        entry["cached"]         = entry["geojson_cached"] or entry["html_cached"]
        entry["artifacts"] = {
            name: f"/nrt/sar/presets/{p.key}/download/{name}"
            for name, path in files.items() if path.exists()
        }
        if files["manifest"].exists():
            try:
                m = json.loads(files["manifest"].read_text())
                entry["summary"] = {
                    "threshold": m.get("threshold"),
                    "area_hectares": m.get("area_hectares"),
                    "orbit": m.get("orbit_selected"),
                }
            except Exception:
                pass
        out.append(entry)
    return out


@router.get("/sar/presets/{key}/geojson")
def get_cached_preset_geojson(key: str):
    p = get_preset(key)
    if not p:
        raise HTTPException(404, f"preset '{key}' not found")
    fp = _preset_files(p.key, p.event_name)["geojson"]
    if not fp.exists():
        raise HTTPException(404, f"preset '{key}' has no cached geojson")
    return JSONResponse(json.loads(fp.read_text()))


@router.get("/sar/presets/{key}/view")
def view_cached_preset_html(key: str):
    """
    Serve the engine-generated HTML map INLINE (no attachment header),
    so the frontend can drop it in an <iframe>.
    """
    p = get_preset(key)
    if not p:
        raise HTTPException(404, f"preset '{key}' not found")
    fp = _preset_files(p.key, p.event_name)["html"]
    if not fp.exists():
        raise HTTPException(404, f"preset '{key}' has no cached html")
    return FileResponse(fp, media_type="text/html")


@router.get("/sar/presets/{key}/download/{artifact}")
def download_preset_artifact(key: str, artifact: str):
    p = get_preset(key)
    if not p:
        raise HTTPException(404, f"preset '{key}' not found")
    files = _preset_files(p.key, p.event_name)
    path = files.get(artifact)
    if not path or not path.exists():
        raise HTTPException(404, f"artifact '{artifact}' not cached for preset '{key}'")
    return FileResponse(path, filename=path.name)


@router.get("/sar/presets/{key}")
def get_sar_preset(key: str):
    p = get_preset(key)
    if not p:
        raise HTTPException(404, f"preset '{key}' not found")
    return next(x for x in list_sar_presets() if x["key"] == key)


# ─────────────────────────────────────────────────────────────
# Live SAR job (order after preset routes)
# ─────────────────────────────────────────────────────────────
class SARFloodRequest(BaseModel):
    project_id: str
    event_name: str = Field(..., min_length=1, max_length=64)
    center_lat: float = Field(..., ge=-90, le=90)
    center_lon: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(..., gt=0, le=100)
    start_date: str
    end_date: str
    change_detection: bool = False
    pass_direction: str = "AUTO"
    polarisation: str = "VV"


@router.post("/sar")
def start_sar_analysis(req: SARFloodRequest):
    job_id = "nrt-" + uuid.uuid4().hex[:10]
    job_store.create(job_id, {"request": req.model_dump()})
    from ..tasks.nrt_sar import run_nrt_sar
    run_nrt_sar.delay(job_id)
    return job_store.get(job_id)


@router.get("/sar/{job_id}/download/{artifact}")
def download_sar_artifact(job_id: str, artifact: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    path = job.get("artifacts", {}).get(artifact)
    if not path or not Path(path).exists():
        raise HTTPException(404, f"artifact '{artifact}' not available")
    return FileResponse(path, filename=Path(path).name)


@router.get("/sar/{job_id}")
def poll_sar(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job
