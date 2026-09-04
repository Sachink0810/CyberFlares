"""
Simulation lifecycle: create, list, poll, upload external SPH results, download.
"""
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse

from ..core import job_store
from ..core.config import settings
from ..models.schemas import SimulationRequest, JobSummary, SPHUploadAck
from ..services.breach.saberi_zenz import compute_hydrograph

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.post("", response_model=JobSummary)
def create_simulation(req: SimulationRequest):
    job_id = uuid.uuid4().hex[:12]
    job_store.create(job_id, {"request": req.model_dump()})

    # Lazy import so worker imports don't cascade at API boot.
    from ..tasks.simulation import run_simulation
    run_simulation.delay(job_id)

    summary = job_store.get(job_id)
    return summary


@router.get("", response_model=list[JobSummary])
def list_simulations(limit: int = 50):
    return job_store.list_all(limit=limit)


@router.get("/{job_id}", response_model=JobSummary)
def get_simulation(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


@router.post("/{job_id}/sph-results", response_model=SPHUploadAck)
async def upload_sph_results(job_id: str, archive: UploadFile = File(...)):
    """
    Called by the GPU laptop's helper script (or manually) with a ZIP of the
    DualSPHysics output (VTK / PartVTK / etc). Extraction lands under
    data/simulations/<job_id>/sph/outputs/.
    """
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if job["status"] not in ("awaiting_external_gpu", "running"):
        raise HTTPException(409, f"job not accepting sph results (status={job['status']})")

    out_dir = settings.sim_dir / job_id / "sph" / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    zip_path = out_dir / "upload.zip"
    total = 0
    with zip_path.open("wb") as f:
        while chunk := await archive.read(1 << 20):
            f.write(chunk)
            total += len(chunk)

    count = 0
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(out_dir)
        count = len(z.namelist())
    zip_path.unlink(missing_ok=True)

    job_store.set_artifact(job_id, "sph_outputs_dir", str(out_dir))
    job_store.update(job_id, phase="sph-results-received")

    # Resume the pipeline downstream of SPH.
    from ..tasks.simulation import resume_after_sph
    resume_after_sph.delay(job_id)

    return SPHUploadAck(job_id=job_id, files_received=count, total_bytes=total)


@router.get("/{job_id}/download/{artifact}")
def download_artifact(job_id: str, artifact: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    path = job.get("artifacts", {}).get(artifact)
    if not path or not Path(path).exists():
        raise HTTPException(404, f"artifact '{artifact}' not available")
    return FileResponse(path, filename=Path(path).name)
