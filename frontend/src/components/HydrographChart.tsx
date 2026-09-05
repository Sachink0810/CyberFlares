import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { AlertCircle, Loader2 } from "lucide-react";

import { useDam } from "../store/damStore";
import { breachPreview } from "../api/client";

const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)} M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(2)} k`
  : n.toFixed(0);

export default function HydrographChart() {
  const dam = useDam((s) => s.dam);

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
    return rows.reduce((best, r) => (r.q > best.q ? r : best), rows[0]).t;
  }, [rows]);

  return (
    <div className="card flex-1 min-h-[320px] flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="eyebrow mb-0.5">Breach hydrograph</div>
          <div className="fs-serif text-lg text-cream leading-tight">
            Outflow discharge · Q(t)
          </div>
          <div className="text-[11px] text-mist mt-0.5">
            Saberi &amp; Zenz · smoothed · mass-balanced to V<sub>w</sub>
          </div>
        </div>
        {isFetching && (
          <Loader2 size={14} className="text-mist animate-spin mt-1" />
        )}
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center text-ember gap-2 text-sm">
          <AlertCircle size={16} /> API error — is the backend up?
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="qFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="#6E9DA5" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#6E9DA5" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ffffff10" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="t" tickLine={false} axisLine={{ stroke: "#ffffff14" }}
              stroke="#9EA4A3" style={{ fontSize: 11, fontFamily: "Inter" }}
              tickFormatter={(v) => `${v.toFixed(1)}h`}
            />
            <YAxis
              tickLine={false} axisLine={{ stroke: "#ffffff14" }}
              stroke="#9EA4A3" style={{ fontSize: 11, fontFamily: "Inter" }}
              tickFormatter={(v) => fmt(v)}
              width={54}
            />
            <Tooltip
              cursor={{ stroke: "#C8785F", strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#0D1112", border: "1px solid #ffffff18",
                borderRadius: 8, fontSize: 12, color: "#F1F0EA",
                fontFamily: "Inter",
              }}
              formatter={(v: number) => [`${fmt(v)} m³/s`, "Discharge"]}
              labelFormatter={(v: number) => `t = ${v.toFixed(2)} h`}
            />
            <ReferenceLine
              x={peakTime}
              stroke="#C8785F"
              strokeDasharray="3 3"
              label={{ value: "peak", fill: "#C8785F", fontSize: 10, position: "top" }}
            />
            <Area
              type="monotone" dataKey="q"
              stroke="#6E9DA5" strokeWidth={2}
              fill="url(#qFill)"
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
            <div className="kpi-label">Breach t_f · h</div>
          </div>
          <div className="kpi">
            <div className="kpi-value">{dam.V_w_mcm.toFixed(1)}</div>
            <div className="kpi-label">Reservoir · Mm³</div>
          </div>
        </div>
      )}
    </div>
  );
}
