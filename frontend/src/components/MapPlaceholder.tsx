import { MapPin } from "lucide-react";
import { useDam } from "../store/damStore";

/**
 * Interim map. Mapbox + deck.gl come in the next round (needs an access
 * token). For now we render a click-to-place mini "map" — a lat/lon grid
 * that lets you shift the dam point relative to the current position.
 */
export default function MapPlaceholder() {
  const dam = useDam((s) => s.dam);
  const setK = useDam((s) => s.set);

  const bump = (dLat: number, dLon: number) => {
    setK("dam_lat", +(dam.dam_lat + dLat).toFixed(4));
    setK("dam_lon", +(dam.dam_lon + dLon).toFixed(4));
  };

  return (
    <div className="card flex-1 min-h-[300px] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none"
           style={{
             backgroundImage:
               "linear-gradient(#23324f 1px, transparent 1px), linear-gradient(90deg, #23324f 1px, transparent 1px)",
             backgroundSize: "48px 48px",
           }} />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">Dam location</div>
          <div className="text-xs text-muted">{dam.name}</div>
        </div>
        <div className="text-right text-xs tabular-nums">
          <div className="text-text">{dam.dam_lat.toFixed(4)}° N</div>
          <div className="text-muted">{dam.dam_lon.toFixed(4)}° E</div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <MapPin size={40} className="text-brand-400 drop-shadow" />
          <div className="text-xs text-muted">
            Mapbox + deck.gl view — coming in round 2
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-1 max-w-[180px] mx-auto text-xs">
        <button className="btn btn-ghost justify-center py-1" onClick={() => bump(+0.01, 0)}>↑</button>
        <span />
        <button className="btn btn-ghost justify-center py-1" onClick={() => bump(0, -0.01)}>←</button>
        <button className="btn btn-ghost justify-center py-1" onClick={() => bump(0, +0.01)}>→</button>
        <button className="btn btn-ghost justify-center py-1" onClick={() => bump(-0.01, 0)}>↓</button>
      </div>
    </div>
  );
}
