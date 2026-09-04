# CyberFlares — Frontend

React 18 + Vite 5 + TypeScript + Tailwind + Recharts + TanStack Query + Zustand.
Runs **natively** with Node 22+, not in Docker.

## Prerequisites

- Node.js 22 or newer (`node --version`)
- The backend running via `docker compose up -d` in the repo root, so
  the FastAPI is reachable at `http://localhost:8000`.

## Setup

```powershell
cd D:\CyberFlares\frontend
npm install
npm run dev
```

Open http://localhost:5173/.

Vite proxies `/api/*` to `http://localhost:8000`, so the browser sees the
API as same-origin. No CORS wrangling needed.

## Scripts

| Command             | Effect                                       |
|---------------------|----------------------------------------------|
| `npm run dev`       | Vite dev-server on :5173 with HMR            |
| `npm run build`     | Type-check + production build to `dist/`     |
| `npm run preview`   | Serve the built assets locally               |
| `npm run lint`      | ESLint (stub — configure before enforcing)   |

## Layout

```
src/
├── main.tsx                    QueryClientProvider + StrictMode entry
├── App.tsx                     3-column layout: params · map · results
├── index.css                   Tailwind base + design-token components
├── types.ts                    Mirrors backend Pydantic schemas
├── api/client.ts               axios client for /api
├── store/damStore.ts           Zustand: dam params + preset library
└── components/
    ├── Header.tsx              Brand + health indicator
    ├── ParameterPanel.tsx      Left sidebar form (preset, params)
    ├── MapPlaceholder.tsx      → replace with Mapbox + deck.gl
    ├── HydrographChart.tsx     Live Recharts area chart
    └── SimulationPanel.tsx     Run + poll job status
```

## What still needs to be built

1. **Mapbox map** — replace `MapPlaceholder.tsx`. Click-to-place dam,
   inundation polygon overlay from the simulation download endpoint,
   deck.gl `PointCloudLayer` for SPH particles.
2. **NRT SAR tab** — bbox draw + date pickers + `GET /api/nrt/sar`.
   Backend endpoint is Phase 4 (not built yet — coordinate with backend).
3. **Downloads panel** — once a job is `completed`, expose buttons for
   `.shp`, `.kml`, hydrograph CSV.
4. **Damage table** — from `/api/simulations/{id}/damage` (backend TBD).
5. **Comparison view** — side-by-side SPH near-field vs Delft3D far-field.

## API contract

The Pydantic schemas in `../backend/app/models/schemas.py` are the source of
truth. `src/types.ts` mirrors them by hand. If the backend schema changes,
update `types.ts` in the same PR. (A future improvement: generate types
automatically with `openapi-typescript` against `http://localhost:8000/openapi.json`.)

## Design tokens

Tailwind config declares:

- Ink shades (`ink-900/800/700/600`) — page and card backgrounds
- Line/text/muted — borders and typography
- Brand blue (`brand-400/500/600`)
- Flood palette (`flood-300/500/700`) — for water depth ramps
- Danger red

Component classes (`.card`, `.input`, `.btn`, `.kpi`) live in `index.css`.
Prefer them over ad-hoc utility strings when adding new UI.
