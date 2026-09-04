import axios from "axios";
import type { BreachResult, DamParameters, JobSummary, SimulationRequest } from "../types";

// Direct-to-API base URL. Override with VITE_API_URL when deploying.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE,
  timeout: 30_000,
});

export const getHealth = () => api.get<{ status: string }>("/health").then(r => r.data);

export const breachPreview = (p: DamParameters) =>
  api.post<BreachResult>("/breach/preview", p).then(r => r.data);

export const createSimulation = (req: SimulationRequest) =>
  api.post<JobSummary>("/simulations", req).then(r => r.data);

export const getSimulation = (id: string) =>
  api.get<JobSummary>(`/simulations/${id}`).then(r => r.data);

export const listSimulations = () =>
  api.get<JobSummary[]>("/simulations").then(r => r.data);
