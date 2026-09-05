import { create } from "zustand";

/**
 * Shared playhead used by the map's timeline strip and the hydrograph
 * chart. When the user drags or plays, both re-render in sync.
 *
 * Deliberately scoped to the breach hydrograph timeline (0 → t_breach)
 * — no fake flood-propagation animation until Delft3D output exists.
 */
interface TimelineState {
  t: number;          // current time in hours (0 → tMax)
  tMax: number;       // total breach duration in hours
  playing: boolean;
  setT: (t: number) => void;
  setTMax: (t: number) => void;
  togglePlay: () => void;
  stop: () => void;
}

export const useTimeline = create<TimelineState>((set) => ({
  t: 0,
  tMax: 2,
  playing: false,
  setT: (t) => set({ t }),
  setTMax: (tMax) => set((s) => ({ tMax, t: Math.min(s.t, tMax) })),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  stop: () => set({ playing: false, t: 0 }),
}));
