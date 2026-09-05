import { create } from "zustand";
import type { JobSummary } from "../types";
import type { SARPresetEntry } from "../api/client";

/**
 * Shared state for the NRT SAR layer.
 *   • jobId/job/geojson  — live GEE run
 *   • activePreset       — the currently-selected cached preset (if any)
 * The map's flood layer renders whichever source is more recent.
 */
interface SarState {
  jobId: string | null;
  job: JobSummary | null;
  geojson: GeoJSON.FeatureCollection | null;
  activePreset: SARPresetEntry | null;
  set: (patch: Partial<SarState>) => void;
  clear: () => void;
}

export const useSar = create<SarState>((set) => ({
  jobId: null,
  job: null,
  geojson: null,
  activePreset: null,
  set: (patch) => set(patch),
  clear: () => set({ jobId: null, job: null, geojson: null, activePreset: null }),
}));
