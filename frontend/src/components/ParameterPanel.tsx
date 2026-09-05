import { useDam, PRESETS } from "../store/damStore";
import type { DamParameters } from "../types";

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

export default function ParameterPanel() {
  const dam = useDam((s) => s.dam);
  const setK = useDam((s) => s.set);
  const reset = useDam((s) => s.reset);

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (!p) return;
    Object.entries(p).forEach(([k, v]) => setK(k as keyof DamParameters, v as never));
  };

  return (
    <aside className="w-[320px] shrink-0 border-r border-white/[.06]
                      bg-graphite/60 backdrop-blur-sm
                      p-5 flex flex-col gap-5 overflow-y-auto">
      <div>
        <div className="eyebrow mb-1">Case</div>
        <h2 className="fs-serif text-2xl leading-tight text-cream mb-4">
          Configure breach.
        </h2>
      </div>

      <div>
        <label className="label">Preset</label>
        <select
          className="input"
          value={
            Object.entries(PRESETS).find(([, v]) => v.name === dam.name)?.[0] ?? ""
          }
          onChange={(e) => applyPreset(e.target.value)}
        >
          <option value="">— custom —</option>
          {Object.keys(PRESETS).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Case name</label>
        <input
          className="input"
          value={dam.name}
          onChange={(e) => setK("name", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Latitude" k="dam_lat" step={0.001} unit="°N" />
        <NumberField label="Longitude" k="dam_lon" step={0.001} unit="°E" />
      </div>

      <div className="border-t border-white/[.06] pt-5">
        <div className="eyebrow mb-3">Breach parameters</div>
        <div className="flex flex-col gap-3">
          <NumberField label="Water height H_w" k="H_w" step={0.1} min={0.1} unit="m" />
          <NumberField label="Reservoir V_w" k="V_w_mcm" step={0.5} min={0.1} unit="Mm³" />
          <NumberField label="Erodibility δ" k="delta" step={0.05} min={0.5} max={3.0} unit="1.0 = high" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="α plateau" k="alpha" step={0.01} min={0} max={0.5} />
            <NumberField label="β transition" k="beta" step={0.01} min={0} max={1} />
          </div>
        </div>
      </div>

      <button className="btn btn-ghost w-full justify-center mt-1" onClick={reset}>
        Reset to Machchhu-II
      </button>
    </aside>
  );
}
