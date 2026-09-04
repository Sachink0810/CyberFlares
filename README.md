# CyberFlares

**SIH 26161 · NTRO · Dam-Break Inundation Modelling Using Hydrodynamic Modelling of any River**

An automated framework for simulating dam-break / GLOF / flash-flood events
on any Indian river. Couples a **Lagrangian near-field solver**
(DualSPHysics / SPH) with an **Eulerian far-field solver** (Delft3D FM),
plus a **Google Earth Engine** near-real-time Sentinel-1 SAR flood tracker,
served through a **React dashboard** that exports to `.shp` / `.kml`.

---

## Contents

1. [What this delivers](#what-this-delivers)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [Quick start (Docker)](#quick-start-docker)
5. [API reference](#api-reference)
6. [The GPU laptop split](#the-gpu-laptop-split)
7. [Status — what's built vs what's next](#status--whats-built-vs-whats-next)
8. [Frontend hand-off notes](#frontend-hand-off-notes)
9. [Development guide](#development-guide)
10. [Reference case studies](#reference-case-studies)
11. [Open data sources](#open-data-sources)
12. [Academic references](#academic-references)

---

## What this delivers

The five NTRO deliverables and where they live in the codebase:

| # | NTRO deliverable | Where |
|---|---|---|
| i | Hydrodynamic + loss engine framework (SPH + Delft3D) | `backend/app/services/{sph,delft3d,postprocess}/` |
| ii | Customized scenario generation from open datasets | `backend/app/services/{geometry,hydrology}/`, `POST /api/simulations` |
| iii | GUI dashboard + `.shp`/`.kml` export | `frontend/`, `backend/app/services/postprocess/` |
| iv | Near-real-time flood analysis via Google Earth Engine | `backend/app/services/gee/`, `GET /api/nrt/sar` |
| v | Live demonstration on Indian river data | `backend/data/precomputed/` (Machchhu-II shipped) |

---

## Architecture

```
                             ┌──────────────────┐
                             │      Browser     │
                             └────────┬─────────┘
                                      │  http/443
                                      ▼
                             ┌──────────────────┐
                             │  cf-nginx :80    │  reverse proxy + TLS
                             └───┬──────────┬───┘
                       /api/*    │          │   /app/*  (Vite HMR)
                                 ▼          ▼
                        ┌──────────────┐  ┌─────────────────┐
                        │ cf-api :8000 │  │ cf-frontend     │
                        │  FastAPI     │  │  React + Vite   │
                        │  Pydantic    │  │  Recharts       │
                        └───┬──────────┘  └─────────────────┘
             enqueue        │   R/W                       Zustand · TanStack Query
                    ┌───────┼─────────────┐
                    ▼       ▼             ▼
             ┌─────────┐ ┌─────────┐ ┌──────────┐
             │cf-redis │ │cf-postgis│ │cf-minio  │
             │ :6379   │ │ :5432    │ │ :9000/1  │
             │broker + │ │spatial DB│ │S3 bucket │
             │job KV   │ │          │ │DEMs/VTK  │
             └─────────┘ └─────────┘ └──────────┘
                    ▲                        ▲
                    │ Celery task queue      │ writes VTK
             ┌──────┴───────┐                │
             │ cf-worker    │                │
             │ Celery       │──► Delft3D FM  │
             │ Rasterio     │    (CPU, in    │
             │ numpy-stl    │     container) │
             │ SPH bridge   │                │
             └──────────────┘                │
                                             │
             ┌──────────────────────┐        │
             │  GPU laptop (extern) │────────┘
             │  DualSPHysics CUDA   │  scripts/run_sph_on_gpu.py
             │  GenCase             │  POST /api/simulations/{id}/sph-results
             └──────────────────────┘

Also running:
  cf-flower :5555   Celery task inspector
```

### Docker services

| Container      | Image                     | Purpose                              | Ports          |
|----------------|---------------------------|--------------------------------------|----------------|
| `cf-nginx`     | `nginx:1.27-alpine`       | Reverse proxy, /api and /app routes  | 80             |
| `cf-frontend`  | Custom (`node:22-alpine`) | React + Vite dev-server (HMR)        | 5173           |
| `cf-api`       | Custom (`python:3.11`)    | FastAPI + Uvicorn                    | 8000 (internal)|
| `cf-worker`    | Same image as api         | Celery worker                        | —              |
| `cf-redis`     | `redis:7-alpine`          | Broker + result backend + job KV     | 6379           |
| `cf-postgis`   | `postgis/postgis:16-3.4`  | Spatial DB                           | 5432           |
| `cf-minio`     | `minio/minio:latest`      | S3-compatible object store           | 9000, 9001     |
| `cf-flower`    | `mher/flower:2.0`         | Celery monitoring UI                 | 5555           |

### Tech stack

**Backend**
Python 3.11 · FastAPI 0.115 · Celery 5.4 · Pydantic v2 · Rasterio + GDAL ·
numpy-stl · scipy · Jinja2 · earthengine-api · xarray + netCDF4 · overpy ·
minio-py.

**Frontend**
React 18 · Vite 5 · TypeScript 5 · Tailwind CSS 3 · Recharts · TanStack
Query · Zustand · lucide-react · axios. (Mapbox GL JS + deck.gl to be
added in the map round.)

**Simulation engines**
DualSPHysics 5.2 (external GPU laptop, CUDA) · Delft3D FM (in-container
CPU, planned for Phase 3).

---

## Repository layout

```
CyberFlares/
├── docker-compose.yml          ← 8-service stack
├── README.md                   ← this file
├── nginx/
│   ├── default.conf            ← reverse proxy config
│   └── html/index.html         ← landing page
├── backend/
│   ├── Dockerfile              ← Python 3.11 + GDAL system libs
│   ├── requirements.txt
│   ├── .env.example            ← copy to .env before first run
│   ├── README.md               ← backend-specific docs
│   ├── app/
│   │   ├── main.py             ← FastAPI entry (health, breach, simulations routers)
│   │   ├── api/
│   │   │   ├── health.py
│   │   │   ├── breach.py       ← POST /breach/preview  (synchronous)
│   │   │   └── simulations.py  ← POST /simulations, GET, upload, download
│   │   ├── core/
│   │   │   ├── config.py       ← pydantic-settings, .env driven
│   │   │   ├── celery_app.py
│   │   │   └── job_store.py    ← Redis-backed job state hash
│   │   ├── models/schemas.py   ← Pydantic request/response models
│   │   ├── services/
│   │   │   ├── breach/saberi_zenz.py         ← Q_p, t_f, smoothed hydrograph
│   │   │   ├── geometry/tif_cropper.py       ← crop DEM to bbox
│   │   │   ├── geometry/stl_generator.py     ← watertight STL + metadata
│   │   │   ├── sph/
│   │   │   │   ├── case_template.xml         ← Jinja2 DualSPHysics template
│   │   │   │   ├── xml_templater.py          ← auto-derives inlet box from DEM
│   │   │   │   └── runner.py                 ← stage_external_inputs / run_local
│   │   │   ├── delft3d/        (Phase 3, stub)
│   │   │   ├── gee/            (Phase 4, stub)
│   │   │   ├── postprocess/    (Phase 5, stub)
│   │   │   └── hydrology/      (India-WRIS fetch, stub)
│   │   └── tasks/simulation.py ← Celery orchestrator (all pipeline phases)
│   ├── scripts/
│   │   └── run_sph_on_gpu.py   ← CLI companion for the GPU laptop
│   └── data/
│       └── precomputed/machchhu/    ← reference Machchhu-II case files
├── frontend/
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx             ← 3-column layout: params · map · results
│       ├── index.css           ← Tailwind base + component tokens
│       ├── types.ts            ← mirrors backend Pydantic schemas
│       ├── api/client.ts       ← axios client for /api
│       ├── store/damStore.ts   ← Zustand state + preset library
│       └── components/
│           ├── Header.tsx
│           ├── ParameterPanel.tsx   ← left sidebar form
│           ├── MapPlaceholder.tsx   ← Mapbox comes next round
│           ├── HydrographChart.tsx  ← live Recharts area chart
│           └── SimulationPanel.tsx  ← run + poll job status
└── legacy/                     ← original prototype scripts (kept for reference)
```

---

## Quick start (Docker)

**Prerequisites**
- Docker Desktop for Windows/Mac (WSL 2 backend on Windows)
- ~15 GB free on the disk hosting Docker's data
- Ports 80, 5173, 5432, 5555, 6379, 9000, 9001 free on the host

**Boot the stack:**

```powershell
cd D:\CyberFlares                           # or wherever you cloned to
copy backend\.env.example backend\.env      # first time only
docker compose up -d --build
```

First build downloads GDAL system packages and pip wheels — allow ~5 min.
Subsequent boots are ~15 s.

**Once healthy:**

| URL                              | What                       |
|----------------------------------|----------------------------|
| http://localhost/                | Landing page               |
| http://localhost/app/            | React dashboard            |
| http://localhost/api/docs        | FastAPI Swagger UI         |
| http://localhost/api/health      | Health probe               |
| http://localhost:5173            | Vite dev-server (direct)   |
| http://localhost:5555            | Celery Flower              |
| http://localhost:9001            | MinIO console              |
| localhost:5432                   | PostgreSQL / PostGIS       |
| localhost:6379                   | Redis                      |

**Credentials:**
- PostGIS: `cyberflares` / `cyberflares` (db `cyberflares`)
- MinIO: `cfadmin` / `cfadmincfadmin`

**Common commands:**

```powershell
docker compose ps                     # health of every service
docker compose logs -f api worker     # tail backend logs
docker compose restart api worker     # after editing backend code
docker compose down                   # stop everything
docker compose down -v                # stop + wipe DB and MinIO
```

---

## API reference

Base URL: `/api` (proxied by nginx to `cf-api:8000`).

### `POST /api/breach/preview`
Synchronous, <100 ms. Returns the full smoothed Saberi & Zenz hydrograph.

Request body:
```json
{
  "name": "Machchhu-II",
  "dam_lat": 22.763, "dam_lon": 70.865,
  "H_w": 22.6, "V_w_mcm": 101.0,
  "delta": 1.0, "alpha": 0.1, "beta": 1.0
}
```
Response: `{peak_discharge_m3s, breach_time_hours, breach_time_seconds, hydrograph: [{t_seconds, t_hours, discharge_m3s} × 100]}`.

### `POST /api/simulations`
Queues a Celery job that walks the full pipeline. Returns immediately with a `job_id`.

Request body:
```json
{
  "dam":  { ...same shape as /breach/preview... },
  "engine": "both",            // "sph" | "delft3d" | "both"
  "near_field_radius_km": 5.0,
  "far_field_radius_km":  50.0,
  "dp_meters": 2.0,
  "dem_source": "fabdem"
}
```

### `GET /api/simulations/{id}`
Poll job state. Progress + phase are updated live by the worker.

Statuses: `queued → running → awaiting_external_gpu → completed | failed | cancelled`
Phases: `queued, breach, dem-crop, stl-build, case-xml, sph-stage,
awaiting-external-gpu, sph-results-received, postprocess, done`

### `POST /api/simulations/{id}/sph-results`
Multipart upload of a ZIP containing the DualSPHysics VTK output. Called
by `scripts/run_sph_on_gpu.py`. Triggers `resume_after_sph` internally.

### `GET /api/simulations/{id}/download/{artifact}`
Stream a produced artifact by name. Names populated by the worker:
`hydrograph_csv`, `nearfield_tif`, `stl`, `case_xml`, `sph_inputs_dir`, `sph_outputs_dir`.

### `GET /api/simulations`
List recent jobs.

### `GET /api/health`
`{status, sph_mode, data_dir}`. Used by the frontend header indicator.

---

## The GPU laptop split

DualSPHysics requires an NVIDIA GPU + CUDA. To keep the dev laptop
lightweight, the pipeline runs everything **except** the SPH solve
in Docker on your dev machine; the actual particle simulation runs on
a separate GPU laptop.

**On the GPU laptop (one-time):**
1. Install NVIDIA CUDA Toolkit 12.x.
2. Install DualSPHysics 5.2 (unzip to e.g. `C:\DualSPHysics5.2`).
3. Copy `scripts/run_sph_on_gpu.py` and install `pip install requests`.

**Each simulation:**
1. Kick off a job from the dashboard → status becomes `awaiting_external_gpu`.
2. On the dev laptop, copy the inputs folder to the GPU laptop:
   ```
   D:\CyberFlares\backend\data\simulations\<job_id>\sph\inputs\
   ```
3. On the GPU laptop:
   ```
   python run_sph_on_gpu.py <inputs_dir> ^
     --dsph-bin "C:/DualSPHysics5.2/bin/windows" ^
     --backend  "http://<dev-machine-ip>/api"
   ```
4. The helper runs `GenCase` → `DualSPHysics5.2CUDA` → `PartVTK`, zips
   the outputs, and POSTs them back. The dashboard automatically
   advances the job to post-processing.

---

## Status — what's built vs what's next

### ✅ Phase 0 — Repo restructure
Complete. Layout above.

### ✅ Phase 1 — Backend skeleton
FastAPI, Celery, Redis, Pydantic schemas, job store. Health probe.

### ✅ Phase 2 — Breach + geometry + SPH stage
- Saberi & Zenz (2015) breach hydrograph (mass-balanced to V_w).
- FABDEM/CartoDEM crop.
- Watertight STL (top + bottom + 4 walls, in local Cartesian metres).
- **`Case_Def.xml` templater** — automatically fills the inlet box
  (`X_MIN/Y_MAX/Z_MIN/...`) from the DEM metadata; no manual XML edit.
- External-mode SPH runner: stages `MANIFEST.json` + `.stl` + `.csv` + `.xml`
  and marks the job `awaiting_external_gpu`.
- SPH results upload endpoint that resumes the pipeline.

### 🚧 Phase 3 — Delft3D far-field (not started)
- `dfm_tools` to generate unstructured grid from a 50 km DEM window.
- Map LULC (ESA WorldCover) → Manning n.
- Run `dflowfm` headless in the worker container.
- Parse `_map.nc` → depth + velocity fields.

### 🚧 Phase 4 — Google Earth Engine SAR module (not started)
- Service-account auth to GEE.
- Sentinel-1 GRD filter → focal-median speckle → Otsu threshold → subtract
  JRC permanent water.
- Endpoint `GET /api/nrt/sar` returning GeoJSON.

### 🚧 Phase 5 — Post-processing + damage overlay (not started)
- VTK → depth raster (via `pyvista` — add back to requirements when
  starting this phase).
- Polygonize + KML export via GDAL/OGR.
- Overpass API fetch of OSM building footprints; damage table into PostGIS.

### ✅ Phase 6 — Frontend scaffold
- 3-column layout: params sidebar · map placeholder · hydrograph + run panel.
- Live hydrograph chart (`POST /api/breach/preview` on every param change).
- Simulation launcher with live status polling.
- Preset switcher (Machchhu-II · Rishi Ganga · Kosi).
- **Next round for the frontend dev**: Mapbox GL JS map with click-to-place
  dam, inundation polygon layer, SPH particle layer via deck.gl, NRT SAR tab.

### 🚧 Phase 7 — Case study bake
Machchhu-II shipped in `backend/data/precomputed/`. Rishi Ganga and Kosi
still to be baked (needs GPU runs).

---

## Frontend hand-off notes

**Everything the frontend needs is in `frontend/` and already boots in
Docker.** The current state is a working skeleton — the person picking
this up should be able to `docker compose up -d frontend` and start
iterating immediately with HMR.

**What's already done (working):**
- Full toolchain (Vite + TS + Tailwind, PostCSS, ESLint stub in package.json).
- Design tokens (`tailwind.config.js` colors + `.card`, `.input`, `.btn`,
  `.kpi` component classes in `src/index.css`).
- API client (`src/api/client.ts`) with typed responses matching the
  backend Pydantic models (`src/types.ts`).
- Zustand store with the dam parameters and 3 preset cases.
- Live hydrograph chart with 3 KPI tiles.
- Simulation launcher with progress bar and status card.
- Header health indicator polling `/api/health` every 15 s.

**What still needs to be built:**

1. **Real map** (`src/components/MapView.tsx` — replace `MapPlaceholder.tsx`)
   - Mapbox GL JS + `react-map-gl@7` (or MapLibre if you want to skip
     the Mapbox token).
   - Basemap: dark satellite.
   - Click on map → set `dam_lat`/`dam_lon` in the Zustand store.
   - Render the inundation polygon from a `.geojson` fetched via the
     simulation download endpoint.
   - deck.gl `PointCloudLayer` for a decimated SPH particle preview.

2. **NRT SAR tab** — new page/tab with:
   - Bbox draw tool (mapbox-gl-draw).
   - Pre/post date pickers.
   - "Check flood extent" button → `GET /api/nrt/sar` (endpoint not
     built yet — coordinate with backend).
   - Result rendered as GeoJSON layer on the map.

3. **Results / downloads panel** — once a job is `completed`:
   - Preview thumbnails of the depth raster (backend must expose a PNG
     preview endpoint — flag when needed).
   - Download buttons for `.shp`, `.kml`, hydrograph CSV.
   - Damage table (from `/api/simulations/{id}/damage` — backend TBD).

4. **Comparison view** — side-by-side or swipe between SPH near-field
   and Delft3D far-field depth rasters.

**API contract stability**
The Pydantic schemas in `backend/app/models/schemas.py` are the source
of truth. `frontend/src/types.ts` mirrors them by hand — if the backend
schema changes, update `types.ts` in the same PR. (Automating this with
`openapi-typescript` against `/api/openapi.json` is a nice future
improvement.)

**How to iterate**
- `docker compose up -d` — everything running.
- Save any file in `frontend/src/**` → Vite HMR refreshes the browser in ~200 ms.
- Direct URL to bypass nginx: `http://localhost:5173/`.
- Direct API for testing: `http://localhost/api/docs`.

---

## Development guide

### Backend

**Edit code, worker doesn't pick it up automatically:**
```powershell
docker compose restart worker
```
(The API auto-reloads via uvicorn's `--reload`; the worker doesn't.)

**Run a Python REPL inside the API container:**
```powershell
docker compose exec api python
```

**Connect to PostGIS:**
```powershell
docker compose exec postgis psql -U cyberflares
```

**Watch Celery tasks live:** http://localhost:5555 (Flower)

### Adding a new pip dep
1. Add to `backend/requirements.txt`.
2. `docker compose build api worker`
3. `docker compose up -d`

### Adding a new npm dep
1. `docker compose exec frontend npm install <pkg>`
2. That updates `package.json` and `package-lock.json` (bind-mounted).

### Env vars
Everything in `backend/.env`. Both api and worker containers read it via
compose's `env_file:` directive.

---

## Reference case studies

Three test-beds are baked into the framework:

| Case | Type | Year | Files shipped | Best solver |
|---|---|---|---|---|
| **Machchhu-II, Gujarat** | Earth-fill embankment | 1979 | `backend/data/precomputed/machchhu/` (FABDEM crop, watertight STL, hydrograph CSVs) | SPH near-field |
| **Rishi Ganga, Uttarakhand** | GLOF · rock-ice avalanche | 2021 | Preset only — needs GPU run | SPH near-field |
| **Kosi River, Bihar** | Embankment breach | 2008 | Preset only — needs Delft3D | Delft3D far-field |

Presets are in `frontend/src/store/damStore.ts`.

---

## Open data sources

| Dataset | Type | Resolution | Where |
|---|---|---|---|
| CartoDEM | DEM (Indian) | 30 m | ISRO Bhuvan portal |
| FABDEM | Bare-earth DEM | 30 m | Univ. of Bristol data.bris |
| Sentinel-1 SAR | GRD radar | 10 m | via Google Earth Engine |
| Sentinel-2 | Optical | 10 m | Copernicus |
| ESA WorldCover | LULC | 10 m | worldcover2020.esa.int |
| JRC Global Surface Water | Permanent water mask | 30 m | via GEE |
| OpenStreetMap | Building/road vectors | high-res | Overpass API |
| India-WRIS | Dam / reservoir data | tabular | indiawris.gov.in |

---

## Academic references

- Saberi & Zenz (2015). *Empirical Relationship for Calculate Outflow
  Hydrograph of the Embankment Dam Breaching Due to Overtopping Failure*.
  Int. J. Hydraulic Engineering 4(3).
- Froehlich, D. C. (2008). *Embankment Dam Breach Parameters and Their
  Uncertainties*. ASCE J. Hydraulic Eng.
- Crespo et al. (2015). *DualSPHysics: Open-source parallel CFD solver
  based on Smoothed Particle Hydrodynamics*. Comp. Phys. Comm.
- Markert et al. (2020). *On the Effect of Landcover Type on Sentinel-1
  Backscatter for Flood Mapping in the Google Earth Engine*. Remote Sensing.
- Otsu, N. (1979). *A Threshold Selection Method from Gray-Level
  Histograms*. IEEE Trans. Syst. Man Cybern.
- Delft3D Flexible Mesh User Manual — Deltares.

---

## Who owns what

- **Backend (Python / FastAPI / Celery / SPH bridge / Delft3D / GEE / postprocess):** Zayed
- **Frontend (React / Mapbox / deck.gl / NRT SAR UI):** handed off — see [Frontend hand-off notes](#frontend-hand-off-notes)
- **GPU simulations (DualSPHysics runs on external laptop):** ad-hoc — anyone with the GPU laptop can run `scripts/run_sph_on_gpu.py`.

---

**License**: TBD (private repo for SIH submission).
**Contact**: Zayed · zayed.ghanchi@stockfundas.com
