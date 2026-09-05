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

// ── Simulations ──
export const createSimulation = (req: SimulationRequest) =>
  api.post<JobSummary>("/simulations", req).then(r => r.data);

export const getSimulation = (id: string) =>
  api.get<JobSummary>(`/simulations/${id}`).then(r => r.data);

export const listSimulations = () =>
  api.get<JobSummary[]>("/simulations").then(r => r.data);

// ── NRT SAR — live jobs ──
export const startSarAnalysis = (req: SARFloodRequest) =>
  api.post<JobSummary>("/nrt/sar", req).then(r => r.data);

export const pollSarAnalysis = (id: string) =>
  api.get<JobSummary>(`/nrt/sar/${id}`).then(r => r.data);

export const sarArtifactUrl = (id: string, artifact: string) =>
  `${BASE}/nrt/sar/${id}/download/${artifact}`;

export const fetchSarGeoJSON = (id: string) =>
  api.get(`/nrt/sar/${id}/download/geojson`).then(r => r.data);

// ── NRT SAR — cached presets (instant demo path) ──
export interface SARPresetEntry {
  key: string;
  event_name: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  start_date: string;
  end_date: string;
  note: string;
  change_detection: boolean;
  pass_direction: string;
  cached: boolean;             // true if geojson OR html is cached
  geojson_cached: boolean;
  html_cached: boolean;
  artifacts?: Record<string, string>;
  summary?: { threshold?: number; area_hectares?: number; orbit?: unknown };
}

export const cachedPresetHtmlUrl = (key: string) =>
  `${BASE}/nrt/sar/presets/${key}/view`;

export const listSarPresets = () =>
  api.get<SARPresetEntry[]>("/nrt/sar/presets").then(r => r.data);

export const fetchCachedPresetGeoJSON = (key: string) =>
  api.get<GeoJSON.FeatureCollection>(`/nrt/sar/presets/${key}/geojson`).then(r => r.data);

export const cachedPresetArtifactUrl = (key: string, artifact: string) =>
  `${BASE}/nrt/sar/presets/${key}/download/${artifact}`;
