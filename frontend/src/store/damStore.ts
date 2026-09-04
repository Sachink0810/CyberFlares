import { create } from "zustand";
import type { DamParameters } from "../types";

// Machchhu-II baseline — matches the precomputed case shipped in backend/data.
const MACHCHHU: DamParameters = {
  name: "Machchhu-II",
  dam_lat: 22.763,
  dam_lon: 70.865,
  H_w: 22.6,
  V_w_mcm: 101.0,
  delta: 1.0,
  alpha: 0.1,
  beta: 1.0,
};

interface DamState {
  dam: DamParameters;
  set: <K extends keyof DamParameters>(k: K, v: DamParameters[K]) => void;
  reset: () => void;
}

export const useDam = create<DamState>((set) => ({
  dam: MACHCHHU,
  set: (k, v) => set((s) => ({ dam: { ...s.dam, [k]: v } })),
  reset: () => set({ dam: MACHCHHU }),
}));

export const PRESETS: Record<string, DamParameters> = {
  "Machchhu-II (1979)": MACHCHHU,
  "Rishi Ganga (2021)": {
    name: "Rishi Ganga GLOF",
    dam_lat: 30.371, dam_lon: 79.723,
    H_w: 40.0, V_w_mcm: 20.0, delta: 0.7, alpha: 0.1, beta: 1.0,
  },
  "Kosi breach (2008)": {
    name: "Kosi embankment",
    dam_lat: 26.512, dam_lon: 86.917,
    H_w: 8.0, V_w_mcm: 150.0, delta: 1.5, alpha: 0.15, beta: 1.0,
  },
};
