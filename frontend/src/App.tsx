import Header from "./components/Header";
import ParameterPanel from "./components/ParameterPanel";
import DamMap from "./components/DamMap";
import DamDossier from "./components/DamDossier";
import ImpactPanel from "./components/ImpactPanel";
import SimulationPanel from "./components/SimulationPanel";
import NRTPanel from "./components/NRTPanel";

/**
 * Dashboard — the console view.
 * Left: scenario registry. Centre: map (locked). Right: one continuous
 * dossier — selected dam, impact estimate, run action, advanced SAR.
 */
export default function App() {
  return (
    <div className="fs-root relative h-full flex flex-col bg-abyss text-cream">
      <div className="fs-grain animate-grain" />

      <Header />

      <div className="relative z-10 flex flex-1 min-h-0">
        <ParameterPanel />

        <main className="flex-1 grid grid-cols-[1fr_380px] gap-4 p-4 overflow-hidden">
          <div className="flex flex-col gap-4 min-h-0">
            <DamMap />
          </div>

          <aside className="bg-graphite/70 border border-white/[.06] rounded-xl backdrop-blur-sm
                            flex flex-col min-h-0 overflow-y-auto divide-y divide-white/[.06]">
            <DamDossier />
            <ImpactPanel />
            <SimulationPanel />
            <NRTPanel />
          </aside>
        </main>
      </div>
    </div>
  );
}
