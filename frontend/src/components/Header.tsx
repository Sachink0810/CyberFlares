import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client";

const NAV = [
  { label: "Simulation", to: "/dashboard" },
  { label: "Terrain", to: "#" },
  { label: "Analysis", to: "#" },
  { label: "Impact", to: "#" },
  { label: "Data", to: "#" },
];

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19) + " UTC";
}

export default function Header() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000,
  });
  const { pathname } = useLocation();
  const clock = useUtcClock();

  const ok = data?.status === "ok";
  const dotClass = isError ? "bg-ember" : ok ? "bg-water" : "bg-steel";

  return (
    <header className="relative z-20 bg-abyss/70 backdrop-blur">
      <div className="flex items-center justify-between h-14 px-6">
        {/* Brand */}
        <Link to="/" className="flex items-baseline gap-2.5 shrink-0">
          <span className="fs-serif text-[19px] leading-none text-cream tracking-tight">
            FLOOD&#8203;//SIM
          </span>
          <span className="hidden sm:inline text-[9.5px] uppercase tracking-[.26em] text-steel">
            HADR Intelligence Platform
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
          {NAV.map((item) => {
            const active = item.to === "/dashboard" && pathname.startsWith("/dashboard");
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`relative text-[11px] uppercase tracking-[.18em] py-1 transition-colors ${
                  active ? "text-cream" : "text-steel hover:text-mist"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute -bottom-[1px] left-0 right-0 h-px bg-water" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status cluster */}
        <div className="flex items-center gap-5 text-[10px] shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-steel">
            <span className="w-1.5 h-1.5 rounded-full bg-water" />
            <span className="uppercase tracking-[.16em]">GPU Ready</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-steel">
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${!isError && ok ? "animate-pulse" : ""}`} />
            <span className="uppercase tracking-[.16em]">
              {isError ? "Offline" : "Data Link"}
            </span>
          </div>
          <span className="hidden xl:inline text-steel tabular-nums tracking-[.08em]">
            {clock}
          </span>
          <div className="w-7 h-7 rounded-full border border-white/[.10] bg-white/[.03]
                          grid place-items-center text-[10px] text-mist tracking-[.04em]">
            KA
          </div>
        </div>
      </div>
      <div className="h-px bg-white/[.06]" />
    </header>
  );
}
