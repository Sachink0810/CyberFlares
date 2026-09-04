import Header from "./components/Header";
import ParameterPanel from "./components/ParameterPanel";
import HydrographChart from "./components/HydrographChart";
import SimulationPanel from "./components/SimulationPanel";
import MapPlaceholder from "./components/MapPlaceholder";

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <Header />

      <div className="flex flex-1 min-h-0">
        <ParameterPanel />

        <main className="flex-1 grid grid-cols-[1fr_420px] gap-4 p-4 overflow-hidden">
          <div className="flex flex-col gap-4 min-h-0">
            <MapPlaceholder />
          </div>

          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            <HydrographChart />
            <SimulationPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
