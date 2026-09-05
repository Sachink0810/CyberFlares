import { create } from "zustand";

/**
 * Single source of truth for "which dam is selected" — shared between
 * the map (marker clicks / fly-to) and the sidebar registry, so either
 * one can drive selection without duplicating fly/param logic.
 */
interface SelectionState {
  selectedId: string;
  setSelectedId: (id: string) => void;
}

export const useSelection = create<SelectionState>((set) => ({
  selectedId: "machchhu-ii",
  setSelectedId: (id) => set({ selectedId: id }),
}));
