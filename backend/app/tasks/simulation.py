"""
End-to-end simulation Celery task.

Pipeline:
    breach hydrograph
        └─► crop DEM
             └─► build watertight STL
                  └─► render Case_Def.xml with derived inlet box
                       └─► stage SPH inputs
                            ├─► [external mode] wait for VTK upload,
                            │      then resume_after_sph → post-process
                            └─► [local mode] run GenCase + DualSPHysics
                                   └─► post-process → shapefile/kml
"""
from __future__ import annotations

from pathlib import Path

from ..core.celery_app import celery_app
from ..core.config import settings
from ..core import job_store

from ..services.breach.saberi_zenz import compute_hydrograph
from ..services.geometry.tif_cropper import crop_dem
from ..services.geometry.stl_generator import generate_nearfield_stl
from ..services.sph.xml_templater import compute_inlet_box, render_case_xml
from ..services.sph import runner as sph_runner


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _resolve_source_dem(dem_source: str) -> Path:
    """
    Locate a DEM file for the requested source. For the SIH demo we ship the
    Machchhu FABDEM tile in precomputed/; production would download here.
    """
    # first look for a per-source directory (dems/fabdem/*.tif etc.)
    src_dir = settings.dem_dir / dem_source
    if src_dir.exists():
        tifs = list(src_dir.glob("*.tif"))
        if tifs:
            return tifs[0]
    # fallback: the precomputed Machchhu near-field crop (good enough for dev)
    fallback = settings.precomputed_dir / "machchhu" / "Machchhu_NearField_5km.tif"
    if fallback.exists():
        return fallback
    raise FileNotFoundError(
        f"No DEM available for source '{dem_source}'. "
        f"Drop a .tif into {src_dir} or the precomputed Machchhu file."
    )


# ---------------------------------------------------------------------------
# main task
# ---------------------------------------------------------------------------

@celery_app.task(name="cyberflares.run_simulation", bind=True)
def run_simulation(self, job_id: str):
    job = job_store.get(job_id)
    if not job:
        return {"error": "job vanished"}

    req = job["request"]
    dam = req["dam"]
    job_dir = settings.sim_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ---- 1. breach hydrograph -----------------------------------------
        job_store.update(job_id, status="running", phase="breach", progress=5)
        hydro_csv = job_dir / "hydrograph.csv"
        hydro = compute_hydrograph(
            H_w=dam["H_w"], V_w_mcm=dam["V_w_mcm"],
            delta=dam["delta"], alpha=dam["alpha"], beta=dam["beta"],
            write_csv=True, csv_path=hydro_csv,
        )
        job_store.set_artifact(job_id, "hydrograph_csv", str(hydro_csv))

        # ---- 2. DEM crop --------------------------------------------------
        job_store.update(job_id, phase="dem-crop", progress=15,
                         peak_discharge_m3s=hydro["peak_discharge_m3s"],
                         breach_time_hours=hydro["breach_time_hours"])
        source_dem = _resolve_source_dem(req["dem_source"])
        cropped = job_dir / "nearfield.tif"
        crop_dem(source_dem, cropped,
                 center_lat=dam["dam_lat"], center_lon=dam["dam_lon"],
                 radius_km=req["near_field_radius_km"])
        job_store.set_artifact(job_id, "nearfield_tif", str(cropped))

        # ---- 3. Watertight STL -------------------------------------------
        job_store.update(job_id, phase="stl-build", progress=30)
        stl_path = job_dir / "nearfield_watertight.stl"
        stl_meta = generate_nearfield_stl(
            cropped, stl_path,
            center_lat=dam["dam_lat"], center_lon=dam["dam_lon"],
            radius_km=req["near_field_radius_km"],
        )
        job_store.set_artifact(job_id, "stl", str(stl_path))

        # ---- 4. SPH XML with derived inlet -------------------------------
        job_store.update(job_id, phase="case-xml", progress=45)
        inlet = compute_inlet_box(stl_meta, cropped, H_w=dam["H_w"])
        case_xml = job_dir / "Case_def.xml"
        render_case_xml(
            case_xml,
            stl_filename=stl_path.name,
            hydrograph_filename=hydro_csv.name,
            inlet_box=inlet,
            dp=req["dp_meters"],
        )
        job_store.set_artifact(job_id, "case_xml", str(case_xml))
        job_store.update(job_id, inlet_box=inlet)

        # ---- 5. Stage SPH inputs -----------------------------------------
        job_store.update(job_id, phase="sph-stage", progress=60)
        inputs = sph_runner.stage_external_inputs(
            job_dir, stl_path, hydro_csv, case_xml, req,
        )
        job_store.set_artifact(job_id, "sph_inputs_dir", str(inputs))

        # ---- 6. Branch: external vs local --------------------------------
        if settings.sph_mode == "external":
            job_store.update(
                job_id,
                status="awaiting_external_gpu",
                phase="awaiting-external-gpu",
                progress=65,
            )
            return {"status": "awaiting_external_gpu", "inputs_dir": str(inputs)}
        else:
            sph_runner.run_local(job_dir, case_xml)
            return resume_after_sph(job_id)

    except Exception as e:
        job_store.update(job_id, status="failed", error=str(e))
        raise


@celery_app.task(name="cyberflares.resume_after_sph", bind=True)
def resume_after_sph(self, job_id: str):
    """
    Continue the pipeline once SPH outputs are on disk (either uploaded via
    /simulations/{id}/sph-results or written by local run_local()).

    Post-processing + Delft3D far-field + shapefile/KML export land here in
    later phases; for now we just mark completion so end-to-end works.
    """
    job_store.update(job_id, phase="postprocess", progress=90)
    # TODO Phase 4-6: VTK → depth raster → polygonize → .shp/.kml,
    #                 Delft3D far-field routing, loss/damage overlay.
    job_store.update(job_id, status="completed", phase="done", progress=100)
    return {"status": "completed"}
