import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { AlertCircle, Loader2 } from "lucide-react";

import { useDam } from "../store/damStore";
import { breachPreview } from "../api/client";

// Compact number formatter used everywhere for m³/s and Mm³.
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)} M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(2)} k`
  : n.toFixed(0);

export default function HydrographChart() {
  const dam = useDam((s) => s.dam);

  // Auto-recompute on every param change (backend runs in <100 ms).
  const key = ["breach", dam];
  const { data, isFetching, error } = useQuery({
    queryKey: key,
    queryFn: () => breachPreview(dam),
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(
    () =>
      data?.hydrograph.map((p) => ({
        t: +p.t_hours.toFixed(3),
        q: p.discharge_m3s,
      })) ?? [],
    [data]
  );

  const peak = data?.peak_discharge_m3s ?? 0;
  const peakTime = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((best, r) => (r.q > best.q ? r : best), rows[0]).t;
  }, [rows]);

  return (
    <div className="card flex-1 min-h-[320px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">Outflow hydrograph</div>
          <div className="text-xs text-muted">
            Saberi & Zenz (2015) · smoothed · mass-balanced to V_w
          </div>
        </div>
        {isFetching && (
          <Loader2 size={14} className="text-muted animate-spin" />
        )}
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center text-danger gap-2 text-sm">
          <AlertCircle size={16} /> API error — is the backend up?
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="q" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#78d1ff" stopOpacity={0.65} />
                <stop offset="100%" stopColor="#78d1ff" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#23324f" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="t" tickLine={false} axisLine={{ stroke: "#23324f" }}
              stroke="#90a0bd" style={{ fontSize: 11 }}
              tickFormatter={(v) => `${v.toFixed(1)}h`}
            />
            <YAxis
              tickLine={false} axisLine={{ stroke: "#23324f" }}
              stroke="#90a0bd" style={{ fontSize: 11 }}
              tickFormatter={(v) => fmt(v)}
              width={54}
            />
            <Tooltip
              cursor={{ stroke: "#5b8def", strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#0f1a30", border: "1px solid #23324f",
                borderRadius: 8, fontSize: 12, color: "#e6edf7",
              }}
              formatter={(v: number) => [`${fmt(v)} m³/s`, "Discharge"]}
              labelFormatter={(v: number) => `t = ${v.toFixed(2)} h`}
            />
            <ReferenceLine
              x={peakTime}
              stroke="#5b8def"
              strokeDasharray="3 3"
              label={{ value: "peak", fill: "#7aa2ff", fontSize: 10, position: "top" }}
            />
            <Area
              type="monotone" dataKey="q"
              stroke="#78d1ff" strokeWidth={2}
              fill="url(#q)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="kpi">
            <div className="kpi-value">{fmt(peak)}</div>
            <div className="kpi-label">Peak Q · m³/s</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{data.breach_time_hours.toFixed(2)}</div>
            <div className="kpi-label">Breach t_f · hours</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">
              {(dam.V_w_mcm).toFixed(1)}
            </div>
            <div className="kpi-label">Reservoir · Mm³</div>
          </div>
        </div>
      )}
    </div>
  );
}
