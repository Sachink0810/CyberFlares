"""
Run every SAR preset through the flood engine once and save results into
``backend/data/precomputed/sar/<key>/``. After this finishes, the
frontend's preset chips serve the resulting GeoJSON instantly.

Usage (inside the api or worker container):
    docker compose exec worker python -m scripts.precache_sar_presets \\
      --project-id sih-26161

Or from the repo root on a machine that has earthengine-api installed:
    python backend/scripts/precache_sar_presets.py --project-id sih-26161
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# Make ``app.*`` importable when run either as a module or as a script.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.core.config import settings                              # noqa: E402
from app.services.gee.presets import SAR_PRESETS                  # noqa: E402
from app.services.gee import flood_engine as fe                   # noqa: E402


LOG = logging.getLogger("precache")


def run_one(project_id: str, preset, force: bool = False) -> bool:
    outdir = settings.precomputed_dir / "sar" / preset.key
    outdir.mkdir(parents=True, exist_ok=True)
    geojson = outdir / f"{preset.event_name}_flood.geojson"

    if geojson.exists() and not force:
        LOG.info("SKIP  %-24s  already cached at %s", preset.key, geojson)
        return True

    LOG.info("RUN   %-24s  → %s", preset.key, outdir)
    t0 = time.time()
    cfg = fe.Config(
        project_id=project_id,
        event_name=preset.event_name,
        center_lat=preset.center_lat,
        center_lon=preset.center_lon,
        radius_km=preset.radius_km,
        start_date=preset.start_date,
        end_date=preset.end_date,
        change_detection=preset.change_detection,
        pass_direction=preset.pass_direction,
        outdir=str(outdir),
    )
    try:
        fe.run(cfg)
        LOG.info("DONE  %-24s  in %.1f s", preset.key, time.time() - t0)
        return True
    except Exception as e:  # noqa: BLE001
        LOG.error("FAIL  %-24s  %s", preset.key, e)
        return False


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--project-id", required=True,
                   help="GCP project with Earth Engine enabled")
    p.add_argument("--only", nargs="*", default=None,
                   help="Restrict to specific preset keys")
    p.add_argument("--force", action="store_true",
                   help="Recompute even if the geojson is already cached")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(message)s",
    )

    targets = SAR_PRESETS
    if args.only:
        targets = [x for x in SAR_PRESETS if x.key in set(args.only)]
        if not targets:
            LOG.error("no presets match --only %s", args.only)
            return 2

    ok = 0
    for preset in targets:
        if run_one(args.project_id, preset, force=args.force):
            ok += 1

    LOG.info("summary: %d/%d succeeded", ok, len(targets))
    return 0 if ok == len(targets) else 1


if __name__ == "__main__":
    raise SystemExit(main())
