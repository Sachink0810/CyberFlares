"""
Quick, synchronous breach-hydrograph endpoint.

Runs the Saberi & Zenz calculation in-request (it's <100 ms) so the frontend
can render the hydrograph chart the moment the user tweaks a slider — no
Celery job needed for the preview.
"""
from fastapi import APIRouter
from ..models.schemas import DamParameters, BreachResult, HydrographPoint
from ..services.breach.saberi_zenz import compute_hydrograph

router = APIRouter(prefix="/breach", tags=["breach"])


@router.post("/preview", response_model=BreachResult)
def breach_preview(dam: DamParameters):
    result = compute_hydrograph(
        H_w=dam.H_w,
        V_w_mcm=dam.V_w_mcm,
        delta=dam.delta,
        alpha=dam.alpha,
        beta=dam.beta,
        num_points=100,
        write_csv=False,
    )
    pts = [
        HydrographPoint(t_seconds=t, t_hours=t / 3600.0, discharge_m3s=q)
        for t, q in zip(result["t_seconds"], result["discharge_m3s"])
    ]
    return BreachResult(
        peak_discharge_m3s=result["peak_discharge_m3s"],
        breach_time_hours=result["breach_time_hours"],
        breach_time_seconds=result["breach_time_seconds"],
        hydrograph_csv_path="",
        hydrograph=pts,
    )
