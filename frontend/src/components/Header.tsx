import { Waves, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client";

export default function Header() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000,
  });

  const ok = data?.status === "ok";
  const dot = isError
    ? "bg-danger"
    : ok
    ? "bg-emerald-400"
    : "bg-yellow-400";

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-line bg-ink-800/60 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Waves className="text-brand-400" size={20} />
        <div>
          <div className="font-semibold leading-4">CyberFlares</div>
          <div className="text-[11px] text-muted leading-3 mt-0.5">
            NTRO · SIH 26161 · Dam-break inundation
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted">
        <a href="/api/docs" target="_blank" className="hover:text-brand-400 flex items-center gap-1.5">
          <Activity size={12} /> API
        </a>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span>{isError ? "API offline" : ok ? "API healthy" : "…"}</span>
        </div>
      </div>
    </header>
  );
}
