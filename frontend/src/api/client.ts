import axios from "axios";
import type {
  BreachResult, DamInfo, DamParameters, JobSummary, SARFloodRequest,
  SimulationRequest,
} from "../types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export const api = axios.create({ baseURL: BASE, timeout: 60_000 });

export const getHealth = () =>
  api.get<{ status: string }>("/health").then(r => r.data);

// ── Dams ──
export const listDams = () =>
  api.get<DamInfo[]>("/dams").then(r => r.data);

export const getDam = (id: string) =>
  api.get<DamInfo>(`/dams/${id}`).then(r => r.data);

// ── Breach preview ──
export const breachPreview = (p: DamParameters) =>
  api.post<BreachResult>("/breach/preview", p).then(r => r.data);

// ── Simulations (SPH + Delft3D pipeline) ──
export const createSimulation = (req: SimulationRequest) =>
  api.post<JobSummary>("/simulations", req).then(r => r.data);

export const getSimulation = (id: string) =>
  api.get<JobSummary>(`/simulations/${id}`).then(r => r.data);

export const listSimulations = () =>
  api.get<JobSummary[]>("/simulations").then(r => r.data);

// ── NRT SAR ──
export const startSarAnalysis = (req: SARFloodRequest) =>
  api.post<JobSummary>("/nrt/sar", req).then(r => r.data);

export const pollSarAnalysis = (id: string) =>
  api.get<JobSummary>(`/nrt/sar/${id}`).then(r => r.data);

export const sarArtifactUrl = (id: string, artifact: string) =>
  `${BASE}/nrt/sar/${id}/download/${artifact}`;

export const fetchSarGeoJSON = (id: string) =>
  api.get(sarArtifactUrl(id, "geojson").replace(BASE, "")).then(r => r.data);
