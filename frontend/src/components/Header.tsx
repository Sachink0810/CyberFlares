import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client";

export default function Header() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000,
  });

  const ok = data?.status === "ok";
  const dotClass = isError ? "bg-ember" : ok ? "bg-water" : "bg-steel";

  return (
    <header className="relative z-20 border-b border-white/[.06]
                       bg-abyss/60 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="fs-serif text-[22px] leading-none text-cream tracking-tight">
            CyberFlares
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-[.28em] text-mist">
            FLOOD // SIM · Console
          </span>
        </Link>

        <div className="flex items-center gap-6 text-xs text-mist">
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
             className="hover:text-cream transition-colors flex items-center gap-1.5">
            <Activity size={12} /> API
          </a>
          <Link to="/" className="hover:text-cream transition-colors">
            Landing
          </Link>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${!isError && ok ? "animate-pulse" : ""}`} />
            <span className="uppercase tracking-[.18em]">
              {isError ? "offline" : ok ? "online" : "…"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
