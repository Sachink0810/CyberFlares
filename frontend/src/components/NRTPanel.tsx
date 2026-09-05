import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Satellite, Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";

import { useDam } from "../store/damStore";
import { useSar } from "../store/sarStore";
import {
  fetchSarGeoJSON, pollSarAnalysis, sarArtifactUrl, startSarAnalysis,
} from "../api/client";
import type { PassDirection } from "../types";

/**
 * NRT SAR panel — Google Earth Engine-based Sentinel-1 flood mapper.
 * AOI defaults to the currently-selected dam. On success, the resulting
 * GeoJSON populates useSar so the map can overlay it as the "Flood"
 * layer.
 */
export default function NRTPanel() {
  const dam = useDam((s) => s.dam);
  const { jobId, job, set: setSar, clear } = useSar();

  const [projectId, setProjectId] = useState<string>(
    (import.meta.env.VITE_GEE_PROJECT_ID as string | undefined) ?? ""
  );
  const [radiusKm, setRadiusKm] = useState(20);
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [pass, setPass] = useState<PassDirection>("AUTO");
  const [changeDet, setChangeDet] = useState(true);

  const start = useMutation({
    mutationFn: () =>
      startSarAnalysis({
        project_id: projectId,
        event_name: `${slug(dam.name)}_${startDate.replaceAll("-", "")}`,
        center_lat: dam.dam_lat,
        center_lon: dam.dam_lon,
        radius_km: radiusKm,
        start_date: startDate,
        end_date: endDate,
        change_detection: changeDet,
        pass_direction: pass,
      }),
    onSuccess: (j) => setSar({ jobId: j.id, job: j, geojson: null }),
  });

  // Poll until terminal
  const poll = useQuery({
    queryKey: ["sar-job", jobId],
    queryFn: () => pollSarAnalysis(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "completed" || s === "failed" || s === "cancelled") return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (poll.data) setSar({ job: poll.data });
  }, [poll.data, setSar]);

  // Once completed, pull the geojson once so the map can render it.
  useEffect(() => {
    if (!jobId || !poll.data || poll.data.status !== "completed") return;
    if (useSar.getState().geojson) return;
    fetchSarGeoJSON(jobId).then((gj) => setSar({ geojson: gj as any })).catch(() => {});
  }, [jobId, poll.data, setSar]);

  const state = job?.status;
  const finished = state === "completed";

  return (
    <details className="filter-group px-5" open={false}>
      <summary className="!py-4">
        <span className="flex items-center gap-2">
          <Satellite size={12} /> Advanced · NRT SAR flood tracker
        </span>
        <span className="text-[9.5px] text-steel normal-case tracking-normal">
          Sentinel-1 · Edge Otsu
        </span>
      </summary>

      <div className="pb-5 flex flex-col gap-3">
      {/* GCP project */}
      <div>
        <label className="label">GCP project</label>
        <input
          className="input"
          placeholder="my-gcp-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
        {!projectId && (
          <div className="text-[10px] text-steel mt-1 leading-tight">
            Set once via <code className="text-water">VITE_GEE_PROJECT_ID</code> in
            your <code className="text-water">.env</code> to skip this field.
          </div>
        )}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Start</label>
          <input className="input" type="date"
                 value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">End</label>
          <input className="input" type="date"
                 value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Radius / pass / change-detection */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Radius km</label>
          <input className="input" type="number" step={5} min={5} max={100}
                 value={radiusKm} onChange={(e) => setRadiusKm(+e.target.value)} />
        </div>
        <div>
          <label className="label">Pass</label>
          <select className="input" value={pass}
                  onChange={(e) => setPass(e.target.value as PassDirection)}>
            <option value="AUTO">AUTO</option>
            <option value="ASCENDING">ASC</option>
            <option value="DESCENDING">DESC</option>
            <option value="BOTH">BOTH</option>
          </select>
        </div>
        <div>
          <label className="label">ΔBase</label>
          <label className="input flex items-center gap-2 !py-1.5 cursor-pointer">
            <input type="checkbox" checked={changeDet}
                   onChange={(e) => setChangeDet(e.target.checked)}
                   className="accent-water" />
            <span className="text-xs">on</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn justify-center"
          disabled={!projectId || start.isPending}
          onClick={() => start.mutate()}
          title={!projectId ? "GCP project id required" : ""}
        >
          {start.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <Satellite size={14} />}
          Run SAR analysis
        </button>
        <button
          className="btn btn-ghost justify-center"
          disabled={!jobId}
          onClick={clear}
        >
          Clear
        </button>
      </div>

      {job && (
        <div className="bg-abyss/70 border border-white/[.06] rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              state === "completed" ? "text-water"
              : state === "failed" ? "text-ember"
              : "text-mist"
            }`}>
              {state === "running" ? <Loader2 size={14} className="animate-spin" /> :
               state === "completed" ? <CheckCircle2 size={14} /> :
               state === "failed" ? <AlertCircle size={14} /> :
               <Loader2 size={14} className="animate-spin" />}
              <span className="uppercase tracking-[.14em] text-[11px]">
                {state}
              </span>
            </div>
            <code className="text-[10px] text-mist">{job.id}</code>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-mist mb-1">
              <span>{job.phase}</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-1 bg-white/[.06] rounded-full overflow-hidden">
              <div className="h-full bg-water transition-all"
                   style={{ width: `${job.progress}%` }} />
            </div>
          </div>

          {finished && job.manifest_summary && (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[10.5px] pt-1">
              {job.manifest_summary.threshold !== undefined && (<>
                <span className="text-mist">Otsu threshold</span>
                <span className="fs-serif text-cream">
                  {job.manifest_summary.threshold.toFixed(2)} dB
                </span>
              </>)}
              {typeof job.manifest_summary.area_hectares === "number" && (<>
                <span className="text-mist">Flood extent</span>
                <span className="fs-serif text-cream">
                  {(job.manifest_summary.area_hectares as number).toFixed(1)} ha
                </span>
              </>)}
              {job.manifest_summary.warnings?.length ? (
                <div className="col-span-2 text-[9.5px] text-ember pt-1">
                  {job.manifest_summary.warnings.length} warning(s) — see manifest
                </div>
              ) : null}
            </div>
          )}

          {finished && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(["geojson", "shp", "kml", "manifest"] as const).map((a) => (
                job.artifacts?.[a] ? (
                  <a key={a} href={sarArtifactUrl(job.id, a)} download
                     className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                                text-[10px] uppercase tracking-[.14em]
                                bg-white/[.05] border border-white/[.08]
                                text-mist hover:text-cream hover:bg-white/[.1]">
                    <Download size={10} /> {a}
                  </a>
                ) : null
              ))}
            </div>
          )}

          {job.error && <div className="text-[11px] text-ember">{job.error}</div>}
        </div>
      )}

      {start.isError && (
        <div className="text-xs text-ember">
          Failed to enqueue — check API logs (or your GCP project).
        </div>
      )}
      </div>
    </details>
  );
}

function defaultEnd() {
  return new Date().toISOString().slice(0, 10);
}
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() - 5);
  return d.toISOString().slice(0, 10);
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}
