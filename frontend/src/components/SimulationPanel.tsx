import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play, Loader2, CheckCircle2, Clock, Server } from "lucide-react";

import { useDam } from "../store/damStore";
import { createSimulation, getSimulation } from "../api/client";
import type { Engine, JobStatus } from "../types";

const STATUS_META: Record<JobStatus, { color: string; label: string; Icon: any }> = {
  queued:                { color: "text-mist",  label: "Queued",       Icon: Clock },
  running:               { color: "text-water", label: "Running",      Icon: Loader2 },
  awaiting_external_gpu: { color: "text-ember", label: "Awaiting GPU", Icon: Server },
  completed:             { color: "text-water", label: "Completed",    Icon: CheckCircle2 },
  failed:                { color: "text-ember", label: "Failed",       Icon: CheckCircle2 },
  cancelled:             { color: "text-mist",  label: "Cancelled",    Icon: CheckCircle2 },
};

export default function SimulationPanel() {
  const dam = useDam((s) => s.dam);
  const [engine, setEngine] = useState<Engine>("both");
  const [nearKm, setNearKm] = useState(5);
  const [farKm, setFarKm] = useState(50);
  const [dp, setDp] = useState(2.0);
  const [jobId, setJobId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createSimulation({
        dam, engine,
        near_field_radius_km: nearKm,
        far_field_radius_km: farKm,
        dp_meters: dp,
        dem_source: "fabdem",
      }),
    onSuccess: (job) => setJobId(job.id),
  });

  const poll = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getSimulation(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "completed" || s === "failed" || s === "cancelled") return false;
      return 2000;
    },
  });

  const job = poll.data;
  const meta = job ? STATUS_META[job.status] : null;

  return (
    <div className="card flex flex-col gap-3">
      <div>
        <div className="eyebrow mb-0.5">Pipeline</div>
        <div className="fs-serif text-lg text-cream leading-tight">
          Run full simulation
        </div>
        <div className="text-[11px] text-mist mt-0.5">
          Breach → DEM crop → STL → Case_Def.xml → SPH inputs staged for GPU.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Engine</label>
          <select className="input" value={engine}
                  onChange={(e) => setEngine(e.target.value as Engine)}>
            <option value="both">SPH + Delft3D</option>
            <option value="sph">SPH only</option>
            <option value="delft3d">Delft3D only</option>
          </select>
        </div>
        <div>
          <label className="label">Near-field</label>
          <input className="input" type="number" step={0.5} min={1}
                 value={nearKm} onChange={(e) => setNearKm(+e.target.value)} />
        </div>
        <div>
          <label className="label">dp (m)</label>
          <input className="input" type="number" step={0.5} min={0.5}
                 value={dp} onChange={(e) => setDp(+e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn justify-center"
          disabled={create.isPending || poll.isRefetching}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run simulation
        </button>
        <button
          className="btn btn-ghost justify-center"
          onClick={() => { setJobId(null); create.reset(); }}
          disabled={!jobId && !create.isError}
        >
          Clear
        </button>
      </div>

      {job && meta && (
        <div className="bg-abyss/70 border border-white/[.06] rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 text-sm font-medium ${meta.color}`}>
              <meta.Icon size={14} className={job.status === "running" ? "animate-spin" : ""} />
              {meta.label}
            </div>
            <code className="text-[10px] text-mist">{job.id}</code>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-mist mb-1">
              <span>{job.phase}</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-1 bg-white/[.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-ember transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
          {job.status === "awaiting_external_gpu" && (
            <div className="text-[11px] text-mist leading-4">
              Copy&nbsp;
              <code className="text-water">data/simulations/{job.id}/sph/inputs/</code>
              &nbsp;to the GPU laptop and run{" "}
              <code className="text-water">scripts/run_sph_on_gpu.py</code>.
            </div>
          )}
          {job.error && <div className="text-[11px] text-ember">{job.error}</div>}
        </div>
      )}

      {create.isError && (
        <div className="text-xs text-ember">Failed to enqueue — check the API logs.</div>
      )}
    </div>
  );
}
