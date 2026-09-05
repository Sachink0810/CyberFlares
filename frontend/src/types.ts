export interface DamParameters {
  name: string;
  dam_lat: number;
  dam_lon: number;
  H_w: number;
  V_w_mcm: number;
  delta: number;
  alpha: number;
  beta: number;
}

export interface DamInfo {
  id: string;
  name: string;
  state: string;
  river: string;
  type: string;
  dam_lat: number;
  dam_lon: number;
  H_w: number;
  V_w_mcm: number;
  delta: number;
  note?: string;
}

export interface HydrographPoint {
  t_seconds: number;
  t_hours: number;
  discharge_m3s: number;
}

export interface BreachResult {
  peak_discharge_m3s: number;
  breach_time_hours: number;
  breach_time_seconds: number;
  hydrograph_csv_path: string;
  hydrograph: HydrographPoint[];
}

export type Engine = "sph" | "delft3d" | "both";

export interface SimulationRequest {
  dam: DamParameters;
  engine: Engine;
  near_field_radius_km: number;
  far_field_radius_km: number;
  dp_meters: number;
  dem_source: "fabdem" | "cartodem" | "srtm";
}

export type JobStatus =
  | "queued"
  | "running"
  | "awaiting_external_gpu"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobSummary {
  id: string;
  status: JobStatus;
  phase: string;
  progress: number;
  created_at: number;
  updated_at: number;
  artifacts: Record<string, string>;
  error: string | null;
  request?: unknown;
  manifest_summary?: {
    orbit?: unknown;
    threshold?: number;
    area_hectares?: unknown;
    warnings?: string[];
  };
}

// ── NRT SAR ────────────────────────────────────────────────────────
export type PassDirection = "AUTO" | "ASCENDING" | "DESCENDING" | "BOTH";

export interface SARFloodRequest {
  project_id: string;
  event_name: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  start_date: string;   // YYYY-MM-DD
  end_date: string;
  change_detection?: boolean;
  pass_direction?: PassDirection;
  polarisation?: "VV" | "VH";
}
