import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { AlertCircle, Loader2 } from "lucide-react";

import { useDam } from "../store/damStore";
import { useTimeline } from "../store/timelineStore";
import { breachPreview } from "../api/client";

const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)} M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(2)} k`
  : n.toFixed(0);

/**
 * Impact Intelligence — right column.
 *
 *   • Computed KPIs · real numbers from the breach hydrograph.
 *   • Hydrograph chart · vertical cursor synced to the map timeline
 *     playhead so the two visualisations move together.
 *   • Post-processing · honest "processing" placeholders. No fabricated
 *     flood extent, depth, or damage numbers until Phase 5 makes them real.
 */
export default function ImpactPanel() {
  const dam = useDam((s) => s.dam);
  const t = useTimeline((s) => s.t);

  const { data, isFetching, error } = useQuery({
    queryKey: ["breach", dam],
    queryFn: () => breachPreview(dam),
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(
    () => data?.hydrograph.map((p) => ({ t: +p.t_hours.toFixed(3), q: p.discharge_m3s })) ?? [],
    [data]
  );
  const peak = data?.peak_discharge_m3s ?? 0;
  const peakTime = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((b, r) => (r.q > b.q ? r : b), rows[0]).t;
  }, [rows]);

  return (
    <div className="px-5 py-5">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="tech-label">Quick impact estimate</div>
        {isFetching && <Loader2 size={11} className="text-mist animate-spin" />}
      </div>

      {/* ── Computed KPIs — 2×2 analytical layout ── */}
      <div className="grid grid-cols-2 gap-x-4">
        <BigKpi value={data ? fmt(peak) : "—"}
                unit="m³/s"     label="Peak discharge" />
        <BigKpi value={data ? peakTime.toFixed(2) : "—"}
                unit="h"        label="Time to peak" />
        <BigKpi value={data ? data.breach_time_hours.toFixed(2) : "—"}
                unit="h"        label="Breach t_f" />
        <BigKpi value={dam.V_w_mcm.toFixed(1)}
                unit="Mm³"      label="Reservoir volume" />
      </div>

      {/* ── Hydrograph (with timeline cursor) ── */}
      <div className="mt-5 pt-5 border-t border-white/[.06]">
        <div className="flex items-baseline justify-between mb-1">
          <div className="tech-label">Outflow hydrograph · Q(t)</div>
        </div>
        <div className="text-[10.5px] text-steel mb-2">
          Saberi &amp; Zenz (2015) · mass-balanced to V<sub>w</sub>
        </div>
        <div className="h-[150px] -ml-2">
          {error ? (
            <div className="h-full flex items-center justify-center text-ember gap-2 text-xs">
              <AlertCircle size={14} /> API error
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="qFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%"   stopColor="#6E9DA5" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#6E9DA5" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff10" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={[0, rows.length ? rows[rows.length - 1].t : 1]}
                  tickLine={false} axisLine={{ stroke: "#ffffff14" }}
                  stroke="#9EA4A3" style={{ fontSize: 10, fontFamily: "Inter" }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}h`}
                />
                <YAxis
                  tickLine={false} axisLine={{ stroke: "#ffffff14" }}
                  stroke="#9EA4A3" style={{ fontSize: 10, fontFamily: "Inter" }}
                  tickFormatter={(v) => fmt(v)} width={44}
                />
                <Tooltip
                  cursor={{ stroke: "#C8785F", strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "#0D1112", border: "1px solid #ffffff18",
                    borderRadius: 8, fontSize: 11, color: "#F1F0EA",
                    fontFamily: "Inter",
                  }}
                  formatter={(v: number) => [`${fmt(v)} m³/s`, "Q"]}
                  labelFormatter={(v: number) => `t = ${v.toFixed(2)} h`}
                />
                <ReferenceLine
                  x={peakTime} stroke="#6E9DA5" strokeDasharray="2 4"
                  label={{ value: "peak", fill: "#6E9DA5", fontSize: 9, position: "top" }}
                />
                {/* Live playhead from the map's timeline */}
                {Number.isFinite(t) && t > 0 && (
                  <ReferenceLine
                    x={t} stroke="#C8785F" strokeWidth={1.5}
                    ifOverflow="hidden"
                  />
                )}
                <Area
                  type="monotone" dataKey="q"
                  stroke="#6E9DA5" strokeWidth={1.8}
                  fill="url(#qFill)" isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Post-processing (honest placeholders) ── */}
      <div className="mt-5 pt-5 border-t border-white/[.06]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="tech-label">Post-processing</div>
          <div className="text-[9.5px] text-steel uppercase tracking-[.16em]">
            awaiting run
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {[
            { l: "Flood extent · km²",     needs: "Delft3D" },
            { l: "Max depth · m",           needs: "SPH VTK" },
            { l: "Max velocity · m/s",      needs: "SPH VTK" },
            { l: "Population affected",     needs: "OSM overlay" },
            { l: "Buildings in high zone",  needs: "OSM overlay" },
            { l: "Damage · ₹Cr",            needs: "depth-damage fn" },
          ].map((k) => (
            <ProcessingCell key={k.l} label={k.l} needs={k.needs} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BigKpi({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="measure border-b border-white/[.06]">
      <div className="flex items-baseline gap-1.5">
        <div className="measure-value">{value}</div>
        <div className="text-[10px] text-mist">{unit}</div>
      </div>
      <div className="measure-label">{label}</div>
    </div>
  );
}

function ProcessingCell({ label, needs }: { label: string; needs: string }) {
  return (
    <div className="py-2 border-b border-white/[.05]">
      <div className="text-mist text-[10px] uppercase tracking-[.14em] leading-tight">
        {label}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="inline-flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-water animate-pulse" />
          <span className="w-1 h-1 rounded-full bg-water animate-pulse" style={{ animationDelay: ".2s" }} />
          <span className="w-1 h-1 rounded-full bg-water animate-pulse" style={{ animationDelay: ".4s" }} />
        </span>
        <span className="text-water text-[10px] uppercase tracking-[.14em]">
          processing
        </span>
      </div>
      <div className="text-[9.5px] text-steel mt-1 leading-tight">
        via {needs}
      </div>
    </div>
  );
}
