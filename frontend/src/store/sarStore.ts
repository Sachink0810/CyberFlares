import { create } from "zustand";
import type { JobSummary } from "../types";

/**
 * Shared state for the NRT SAR flood layer.
 * Populated by NRTPanel; consumed by DamMap (to draw the polygons) and
 * the layer toggle (to enable the "Flood" button once results exist).
 */
interface SarState {
  jobId: string | null;
  job: JobSummary | null;
  geojson: GeoJSON.FeatureCollection | null;
  set: (patch: Partial<SarState>) => void;
  clear: () => void;
}

export const useSar = create<SarState>((set) => ({
  jobId: null,
  job: null,
  geojson: null,
  set: (patch) => set(patch),
  clear: () => set({ jobId: null, job: null, geojson: null }),
}));
