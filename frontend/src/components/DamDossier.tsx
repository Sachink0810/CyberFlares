import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Waves } from "lucide-react";

import { useDam } from "../store/damStore";
import { useSelection } from "../store/selectionStore";
import { listDams } from "../api/client";

function tileHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export default function DamDossier() {
  const dam = useDam((s) => s.dam);
  const selectedId = useSelection((s) => s.selectedId);

  const { data: dams } = useQuery({
    queryKey: ["dams"],
    queryFn: listDams,
    staleTime: 5 * 60_000,
  });

  const info = useMemo(() => dams?.find((d) => d.id === selectedId), [dams, selectedId]);
  const index = useMemo(
    () => (dams ? dams.findIndex((d) => d.id === selectedId) + 1 : 0),
    [dams, selectedId]
  );
  const hue = tileHue(selectedId);

  return (
    <div className="px-5 py-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="tech-label">Selected dam</div>
        <div className="tech-label tabular-nums">
          {index ? String(index).padStart(2, "0") : "—"} / {dams?.length ?? "—"}
        </div>
      </div>

      <h2 className="fs-serif text-[30px] leading-[1.02] text-cream">{dam.name}</h2>
      {info && (
        <div className="text-[12px] text-mist mt-1">{info.state}, India</div>
      )}

      {/* Visual identity tile — no stock photography available, so a
          stable abstract gradient keyed to the dam id stands in, framed
          the way an image would be. */}
      <div
        className="mt-4 h-32 rounded-lg relative overflow-hidden flex items-end"
        style={{
          background: `radial-gradient(120% 140% at 15% -10%, hsl(${hue} 30% 20%), transparent 60%),
                        linear-gradient(160deg, hsl(${hue} 22% 12%), #070A0B 85%)`,
          border: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <Waves size={64} strokeWidth={0.8}
               style={{ color: `hsl(${hue} 34% 55%)`, opacity: 0.35, position: "absolute", right: 10, top: 10 }} />
        <div className="relative z-10 px-3.5 py-2.5 text-[10px] uppercase tracking-[.16em] text-mist">
          {info ? `${info.river} river system` : "River system"}
        </div>
      </div>

      <div className="mt-3 text-[11px] text-mist tabular-nums">
        {dam.dam_lat.toFixed(4)}° N, {dam.dam_lon.toFixed(4)}° E
      </div>

      {/* Spec sheet */}
      <div className="mt-4 grid grid-cols-2 gap-x-4">
        <Spec label="River" value={info?.river ?? "—"} />
        <Spec label="Type" value={info?.type ?? "—"} />
        <Spec label="Height" value={`${dam.H_w.toFixed(1)} m`} />
        <Spec label="Reservoir" value={`${dam.V_w_mcm.toFixed(0)} Mm³`} />
      </div>

      {info?.note && (
        <div className="mt-4 pt-4 border-t border-white/[.06]">
          <p className="text-[11.5px] text-mist leading-relaxed">{info.note}</p>
        </div>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="measure border-b border-white/[.06]">
      <div className="measure-label">{label}</div>
      <div className="measure-value !text-[17px]">{value}</div>
    </div>
  );
}
