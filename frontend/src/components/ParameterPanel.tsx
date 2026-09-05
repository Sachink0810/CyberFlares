import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, ChevronDown, MapPin, Waves, Layers } from "lucide-react";

import { useDam, PRESETS } from "../store/damStore";
import { useSelection } from "../store/selectionStore";
import { listDams } from "../api/client";
import type { DamInfo, DamParameters } from "../types";

function NumberField({
  label, k, step = 0.01, min, max, unit,
}: {
  label: string; k: keyof DamParameters;
  step?: number; min?: number; max?: number; unit?: string;
}) {
  const value = useDam((s) => s.dam[k]);
  const setK = useDam((s) => s.set);
  return (
    <div>
      <label className="label flex justify-between">
        <span>{label}</span>
        {unit && <span className="text-steel normal-case tracking-normal text-[10px]">{unit}</span>}
      </label>
      <input
        className="input tabular-nums"
        type="number"
        value={value as number}
        step={step} min={min} max={max}
        onChange={(e) => setK(k, parseFloat(e.target.value) as never)}
      />
    </div>
  );
}

// Deterministic muted tile colour for a dam "thumbnail" — we have no
// photography for the registry, so each row gets a stable abstract tile
// instead of a fake stock photo.
function tileHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function DamThumb({ d, active }: { d: DamInfo; active: boolean }) {
  const hue = tileHue(d.id);
  return (
    <div
      className="w-9 h-9 rounded-md shrink-0 grid place-items-center overflow-hidden"
      style={{
        background: `linear-gradient(155deg, hsl(${hue} 28% 16%), hsl(${hue} 22% 8%))`,
        border: active ? "1px solid rgba(110,157,165,.5)" : "1px solid rgba(255,255,255,.06)",
      }}
    >
      <Waves size={13} style={{ color: `hsl(${hue} 30% 60%)`, opacity: 0.85 }} />
    </div>
  );
}

export default function ParameterPanel() {
  const dam = useDam((s) => s.dam);
  const setK = useDam((s) => s.set);
  const selectedId = useSelection((s) => s.selectedId);
  const setSelectedId = useSelection((s) => s.setSelectedId);

  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: dams } = useQuery({
    queryKey: ["dams"],
    queryFn: listDams,
    staleTime: 5 * 60_000,
  });

  const states = useMemo(
    () => Array.from(new Set((dams ?? []).map((d) => d.state))).sort(),
    [dams]
  );
  const types = useMemo(
    () => Array.from(new Set((dams ?? []).map((d) => d.type))).sort(),
    [dams]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (dams ?? []).filter((d) => {
      if (stateFilter && d.state !== stateFilter) return false;
      if (typeFilter && d.type !== typeFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.river.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q)
      );
    });
  }, [dams, query, stateFilter, typeFilter]);

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (!p) return;
    Object.entries(p).forEach(([k, v]) => setK(k as keyof DamParameters, v as never));
  };

  const runAnchor = () =>
    document.getElementById("cf-run-simulation")?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <aside className="w-[320px] shrink-0 border-r border-white/[.06]
                      bg-graphite/50 backdrop-blur-sm
                      flex flex-col min-h-0">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="tech-label mb-2">01 &nbsp;·&nbsp; Scenario</div>
        <h2 className="fs-serif text-[26px] leading-[1.05] text-cream">
          Select a dam.
        </h2>
        <p className="text-[11.5px] text-mist mt-2 leading-relaxed">
          Configure and simulate downstream flood scenarios.
        </p>
      </div>

      {/* ── Search ── */}
      <div className="px-5 pb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            className="w-full bg-abyss/70 border border-white/[.08] rounded-md
                       pl-8 pr-3 py-2 text-[12.5px] text-cream placeholder:text-steel
                       focus:outline-none focus:border-water/50 transition-colors"
            placeholder="Search dam, river or state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Registry list ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3">
        {!dams && (
          <div className="px-2 py-3 text-[11px] text-steel">Loading registry…</div>
        )}
        {dams && filtered.length === 0 && (
          <div className="px-2 py-3 text-[11px] text-steel">No dams match.</div>
        )}
        {filtered.map((d, i) => {
          const active = d.id === selectedId;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`asset-row w-full text-left ${active ? "is-active" : ""}`}
            >
              <span className="tech-label w-5 text-right tabular-nums shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <DamThumb d={d} active={active} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={`text-[13px] truncate ${active ? "text-cream" : "text-cream/85"}`}>
                    {d.name}
                  </span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-water shrink-0" />}
                </span>
                <span className="block text-[10.5px] text-mist truncate">{d.state}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="px-5 border-t border-white/[.06] pt-1">
        <details className="filter-group border-b border-white/[.06]">
          <summary>
            <span className="flex items-center gap-2">
              <MapPin size={11} /> By state
            </span>
            <ChevronDown size={12} className="transition-transform [details[open]_&]:rotate-180" />
          </summary>
          <div className="pb-2.5 flex flex-wrap gap-1.5">
            {states.map((s) => (
              <button
                key={s}
                onClick={() => setStateFilter(stateFilter === s ? null : s)}
                className={`text-[10px] uppercase tracking-[.1em] px-2 py-1 rounded
                            border transition-colors ${
                  stateFilter === s
                    ? "border-water/50 text-cream bg-water/[.08]"
                    : "border-white/[.08] text-mist hover:text-cream"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </details>
        <details className="filter-group border-b border-white/[.06]">
          <summary>
            <span className="flex items-center gap-2">
              <Layers size={11} /> By dam type
            </span>
            <ChevronDown size={12} className="transition-transform [details[open]_&]:rotate-180" />
          </summary>
          <div className="pb-2.5 flex flex-wrap gap-1.5">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`text-[10px] uppercase tracking-[.1em] px-2 py-1 rounded
                            border transition-colors ${
                  typeFilter === t
                    ? "border-water/50 text-cream bg-water/[.08]"
                    : "border-white/[.08] text-mist hover:text-cream"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </details>

        {/* ── Advanced breach parameters (collapsed, existing functionality) ── */}
        <details className="filter-group">
          <summary>
            <span>Advanced · breach parameters</span>
            <ChevronDown size={12} className="transition-transform [details[open]_&]:rotate-180" />
          </summary>
          <div className="pb-3 flex flex-col gap-3">
            <div>
              <label className="label">Preset</label>
              <select
                className="input"
                value={Object.entries(PRESETS).find(([, v]) => v.name === dam.name)?.[0] ?? ""}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="">— custom —</option>
                {Object.keys(PRESETS).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Latitude" k="dam_lat" step={0.001} unit="°N" />
              <NumberField label="Longitude" k="dam_lon" step={0.001} unit="°E" />
            </div>
            <NumberField label="Water height H_w" k="H_w" step={0.1} min={0.1} unit="m" />
            <NumberField label="Reservoir V_w" k="V_w_mcm" step={0.5} min={0.1} unit="Mm³" />
            <NumberField label="Erodibility δ" k="delta" step={0.05} min={0.5} max={3.0} unit="1.0 = high" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="α plateau" k="alpha" step={0.01} min={0} max={0.5} />
              <NumberField label="β transition" k="beta" step={0.01} min={0} max={1} />
            </div>
          </div>
        </details>
      </div>

      {/* ── Actions ── */}
      <div className="px-5 py-4 border-t border-white/[.06] flex flex-col gap-2">
        <button
          className="btn-secondary w-full"
          title="Import custom DEM / dam parameters (coming soon)"
          disabled
        >
          Import custom data
        </button>
        <button className="btn-primary w-full" onClick={runAnchor}>
          Configure &amp; run
          <ArrowRight size={14} />
        </button>
      </div>
    </aside>
  );
}
