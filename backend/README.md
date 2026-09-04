# CyberFlares backend

FastAPI + Celery service; the whole stack runs in Docker Compose so no local
Python/GDAL/OpenBLAS install is needed.

## Quick start

```bash
# From the repo root:
cp backend/.env.example backend/.env    # first time only
docker compose up -d --build
```

Once the containers are healthy:

| URL                                    | What                          |
|----------------------------------------|-------------------------------|
| http://localhost/                      | Landing page                  |
| http://localhost/api/docs              | FastAPI Swagger UI            |
| http://localhost/api/health            | Health probe                  |
| http://localhost:5555                  | Celery Flower                 |
| http://localhost:9001                  | MinIO console  (cfadmin/…)    |
| localhost:5432                         | PostgreSQL  (cyberflares/…)   |
| localhost:6379                         | Redis                         |

Follow logs:

```bash
docker compose logs -f api worker
```

## Trying the pipeline (Machchhu-II)

```bash
curl -X POST http://localhost/api/breach/preview \
  -H 'content-type: application/json' \
  -d '{"name":"Machchhu-II","dam_lat":22.763,"dam_lon":70.865,
       "H_w":22.6,"V_w_mcm":101,"delta":1.0,"alpha":0.1,"beta":1.0}'
```

Kick off a full simulation:

```bash
curl -X POST http://localhost/api/simulations \
  -H 'content-type: application/json' \
  -d '{"dam":{"name":"Machchhu-II","dam_lat":22.763,"dam_lon":70.865,
             "H_w":22.6,"V_w_mcm":101,"delta":1.0,"alpha":0.1,"beta":1.0},
       "engine":"both","near_field_radius_km":5.0,
       "far_field_radius_km":50.0,"dp_meters":2.0,"dem_source":"fabdem"}'
```

The job goes to `awaiting_external_gpu` once the SPH inputs are staged. Copy
`data/simulations/<job_id>/sph/inputs/` to the GPU laptop and run
`scripts/run_sph_on_gpu.py`; it uploads the VTK zip and the pipeline resumes.

## GPU laptop (outside Docker)

```
python scripts/run_sph_on_gpu.py <inputs_dir> \
  --dsph-bin "C:/DualSPHysics5.2/bin/windows" \
  --backend  "http://<dev-machine-ip>/api"
```

## Editing code

`backend/app` and `backend/scripts` are bind-mounted, so save-in-editor →
`uvicorn --reload` picks it up. For Celery, restart the worker:

```bash
docker compose restart worker
```
