import Header from "./components/Header";
import ParameterPanel from "./components/ParameterPanel";
import DamMap from "./components/DamMap";
import ImpactPanel from "./components/ImpactPanel";
import SimulationPanel from "./components/SimulationPanel";

/**
 * Dashboard — the console view.
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Header                                                        │
 *   ├──────────────┬────────────────────────────────────┬──────────┤
 *   │              │                                    │          │
 *   │  Parameters  │              MAP (hero)             │  Impact  │
 *   │  280 px      │              1 fr                   │  360 px  │
 *   │              │                                    │  + Run   │
 *   └──────────────┴────────────────────────────────────┴──────────┘
 *
 * The map dominates the visual weight; parameters and impact intelligence
 * flank it as narrow rails.
 */
export default function App() {
  return (
    <div className="fs-root relative h-full flex flex-col bg-abyss text-cream">
      <div className="fs-grain animate-grain" />

      <Header />

      <div className="relative z-10 flex flex-1 min-h-0">
        <ParameterPanel />

        <main className="flex-1 grid grid-cols-[1fr_360px] gap-4 p-4 overflow-hidden">
          <div className="flex flex-col gap-4 min-h-0">
            <DamMap />
          </div>

          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
            <ImpactPanel />
            <SimulationPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
