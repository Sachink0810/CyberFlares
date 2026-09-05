import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Satellite, Zap } from "lucide-react";
import type { Map as MLMap } from "maplibre-gl";

import {
  fetchCachedPresetGeoJSON, listSarPresets, type SARPresetEntry,
} from "../api/client";
import { useSar } from "../store/sarStore";

/**
 * Preset-chip HUD, rendered on top of the map.
 *
 * One chip per curated event. Clicking it:
 *   1. Flies the map to the preset AOI (tilt + bounding-box fit)
 *   2. Loads the CACHED SAR GeoJSON (instant) and pushes it into useSar
 *      so the map's flood layer renders the polygons immediately
 * If a preset isn't cached yet, the chip is still clickable — the map
 * still flies, but the flood layer just doesn't appear (an amber
 * "not cached" dot warns visually).
 */
export default function SarPresetChips({ mapRef }: { mapRef: React.MutableRefObject<MLMap | null> }) {
  const setSar = useSar((s) => s.set);
  const activeKey = useSar((s) => s.activePreset?.key);

  const { data: presets = [] } = useQuery({
    queryKey: ["sar-presets"],
    queryFn: listSarPresets,
    staleTime: 5 * 60_000,
  });

  async function pick(p: SARPresetEntry) {
    // Fly to the AOI
    const m = mapRef.current;
    if (m) {
      // approx bounding box from radius (deg)
      const dLat = p.radius_km / 111.32;
      const dLon = p.radius_km / (111.32 * Math.cos((p.center_lat * Math.PI) / 180));
      m.fitBounds(
        [[p.center_lon - dLon, p.center_lat - dLat],
         [p.center_lon + dLon, p.center_lat + dLat]],
        { padding: 80, pitch: 45, bearing: 0, duration: 1600 }
      );
    }

    setSar({ activePreset: p, geojson: null, jobId: null, job: null });

    // Load vector geojson if we have it (fast overlay on our map).
    if (p.geojson_cached) {
      try {
        const gj = await fetchCachedPresetGeoJSON(p.key);
        setSar({ geojson: gj });
      } catch { /* silent */ }
    }
    // If only the HTML is cached, the DamMap will offer an "Engine view"
    // button — the html_cached flag on activePreset drives that.
  }

  // Auto-select the first cached preset on first mount, if the sar store is empty.
  useEffect(() => {
    if (!presets.length) return;
    const s = useSar.getState();
    if (s.activePreset || s.jobId || s.geojson) return;
    const first = presets.find((p) => p.cached) ?? presets[0];
    if (first?.cached) pick(first);
    // Note: `cached` is true when EITHER geojson OR html is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  if (!presets.length) return null;

  return (
    <div className="absolute z-10 top-[46px] left-1/2 -translate-x-1/2 pointer-events-auto">
      <div className="bg-abyss/85 backdrop-blur border border-white/[.06]
                      rounded-full p-1 flex items-center gap-1 shadow-lg shadow-black/40">
        <div className="pl-3 pr-1 text-[10px] uppercase tracking-[.20em]
                        text-water flex items-center gap-1.5">
          <Satellite size={11} /> Cached flood events
        </div>
        {presets.map((p) => {
          const isActive = p.key === activeKey;
          return (
            <button
              key={p.key}
              onClick={() => pick(p)}
              className={`group relative flex items-center gap-1.5 pl-3 pr-3 py-1.5
                          rounded-full text-[11px] transition
                          ${isActive
                            ? "bg-ember text-abyss font-medium"
                            : "text-mist hover:text-cream hover:bg-white/[.05]"}`}
              title={p.note}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                p.cached ? "bg-water" : "bg-ember/70"
              } ${isActive ? "!bg-abyss" : ""}`} />
              {p.event_name}
              {p.summary?.area_hectares !== undefined && (
                <span className={`text-[9.5px] tabular-nums ${
                  isActive ? "text-abyss/80" : "text-steel"
                }`}>
                  {(p.summary.area_hectares as number).toFixed(0)} ha
                </span>
              )}
            </button>
          );
        })}
        {activeKey && (
          <button
            onClick={() => useSar.getState().clear()}
            className="ml-1 pl-2 pr-3 py-1.5 text-[10px] uppercase tracking-[.16em]
                       text-steel hover:text-cream"
            title="Clear flood overlay"
          >
            <Zap size={10} className="inline mr-1" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
