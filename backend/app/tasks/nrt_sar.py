"""
Celery task that runs the NRT SAR flood engine.

The engine can take minutes (GEE server-side reductions + composite +
Otsu + vectorise), so it must not block the API. State is stored in the
same Redis-backed job_store the simulation pipeline uses, under an
``nrt:`` prefix.
"""
from __future__ import annotations

from ..core.celery_app import celery_app
from ..core import job_store
from ..services.gee.wrapper import run_flood_analysis


@celery_app.task(name="cyberflares.run_nrt_sar", bind=True)
def run_nrt_sar(self, job_id: str):
    job = job_store.get(job_id)
    if not job:
        return {"error": "job vanished"}

    req = job["request"]
    try:
        job_store.update(job_id, status="running", phase="running-gee", progress=15)

        result = run_flood_analysis(
            job_id=job_id,
            project_id=req["project_id"],
            event_name=req["event_name"],
            center_lat=req["center_lat"],
            center_lon=req["center_lon"],
            radius_km=req["radius_km"],
            start_date=req["start_date"],
            end_date=req["end_date"],
            change_detection=req.get("change_detection", False),
            pass_direction=req.get("pass_direction", "AUTO"),
            polarisation=req.get("polarisation", "VV"),
        )

        # Record every generated artifact so the frontend can download them.
        for name, path in result.products.items():
            job_store.set_artifact(job_id, name, path)

        job_store.update(
            job_id,
            status="completed", phase="done", progress=100,
            manifest_summary={
                "orbit": result.manifest.get("orbit_selected"),
                "threshold": result.manifest.get("threshold"),
                "area_hectares": result.manifest.get("area_hectares"),
                "warnings": result.manifest.get("warnings", []),
            },
        )
        return {"status": "completed", "job_id": job_id}
    except Exception as e:  # noqa: BLE001
        job_store.update(job_id, status="failed", error=str(e))
        raise
