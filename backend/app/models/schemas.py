"""
Pydantic request / response schemas used across the API surface.
"""
from typing import Literal, Any
from pydantic import BaseModel, Field


Engine = Literal["sph", "delft3d", "both"]


class DamParameters(BaseModel):
    """Physical parameters that drive the Saberi & Zenz breach hydrograph."""
    name: str = Field(..., description="Human-readable case name, e.g. 'Machchhu-II'")
    dam_lat: float
    dam_lon: float
    H_w: float = Field(..., gt=0, description="Height of water at breach (m)")
    V_w_mcm: float = Field(..., gt=0, description="Reservoir volume at breach (million m^3)")
    delta: float = Field(1.0, ge=0.5, le=3.0,
                         description="Erodibility factor (1.0 highly erodible → 2.0 low erodibility)")
    alpha: float = Field(0.1, ge=0.0, le=0.5, description="Peak-plateau width ratio")
    beta: float = Field(1.0, ge=0.0, le=1.0, description="Triangular transition height ratio")


class SimulationRequest(BaseModel):
    dam: DamParameters
    engine: Engine = "both"
    near_field_radius_km: float = 5.0
    far_field_radius_km: float = 50.0
    dp_meters: float = Field(2.0, gt=0.1, description="SPH particle spacing")
    dem_source: Literal["fabdem", "cartodem", "srtm"] = "fabdem"


class HydrographPoint(BaseModel):
    t_seconds: float
    t_hours: float
    discharge_m3s: float


class BreachResult(BaseModel):
    peak_discharge_m3s: float
    breach_time_hours: float
    breach_time_seconds: float
    hydrograph_csv_path: str
    hydrograph: list[HydrographPoint]


class JobSummary(BaseModel):
    id: str
    status: Literal["queued", "running", "awaiting_external_gpu",
                    "completed", "failed", "cancelled"]
    phase: str
    progress: int
    created_at: float
    updated_at: float
    artifacts: dict[str, str] = {}
    error: str | None = None
    request: dict[str, Any] | None = None


class SPHUploadAck(BaseModel):
    job_id: str
    files_received: int
    total_bytes: int


class SARFloodRequest(BaseModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float
    pre_start: str  # ISO date
    pre_end: str
    post_start: str
    post_end: str
    threshold_db: float | None = None  # None → run Otsu server-side
