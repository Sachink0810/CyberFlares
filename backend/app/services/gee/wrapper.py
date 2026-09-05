"""
Thin wrapper around ``flood_engine.run(cfg)``.

Handles:
  * Filesystem plumbing — puts outputs under ``data/gee/<job_id>/``.
  * Service-account authentication in Docker (falls back to
    interactive/cached credentials when the JSON path is empty).
  * Post-run product discovery — returns the paths of every artifact
    the engine actually produced so the API can list them.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ...core.config import settings
from . import flood_engine as fe


@dataclass
class FloodAnalysisResult:
    job_id: str
    outdir: Path
    manifest: dict[str, Any]
    products: dict[str, str]      # {"geojson": "...", "kml": "...", ...}


def _service_account_init(project_id: str) -> bool:
    """
    Initialize Earth Engine with a service-account JSON if one is
    configured; return True on success, False otherwise.
    """
    key_path = settings.gee_key_json
    email = settings.gee_service_account
    if not (key_path and email and Path(key_path).exists()):
        return False

    import ee  # local import so the module loads even without ee at import time

    creds = ee.ServiceAccountCredentials(email, key_path)
    ee.Initialize(creds, project=project_id)
    return True


def run_flood_analysis(
    *,
    job_id: str,
    project_id: str,
    event_name: str,
    center_lat: float,
    center_lon: float,
    radius_km: float,
    start_date: str,
    end_date: str,
    change_detection: bool = False,
    pass_direction: str = "AUTO",
    polarisation: str = "VV",
) -> FloodAnalysisResult:
    """
    Run the Markert-style NRT flood engine for one AOI + date window and
    return the manifest plus paths of every generated artifact.
    """
    outdir = settings.data_dir / "gee" / job_id
    outdir.mkdir(parents=True, exist_ok=True)

    # Try service-account init first; if it succeeds the engine's own
    # ee.Initialize(project=...) call inside run() is a no-op-safe re-init.
    _service_account_init(project_id)

    cfg = fe.Config(
        project_id=project_id,
        event_name=event_name,
        center_lat=center_lat,
        center_lon=center_lon,
        radius_km=radius_km,
        start_date=start_date,
        end_date=end_date,
        change_detection=change_detection,
        pass_direction=pass_direction,
        polarisation=polarisation,
        outdir=str(outdir),
    )

    manifest = fe.run(cfg)

    # Discover which artifacts were actually written.
    prefix = event_name
    candidates = {
        "geojson":  outdir / f"{prefix}_flood.geojson",
        "shp":      outdir / f"{prefix}_flood.shp",
        "kml":      outdir / f"{prefix}_flood.kml",
        "html":     outdir / f"{prefix}_map.html",
        "manifest": outdir / f"{prefix}_manifest.json",
    }
    products: dict[str, str] = {}
    for name, p in candidates.items():
        if p.exists():
            products[name] = str(p)

    return FloodAnalysisResult(
        job_id=job_id, outdir=outdir, manifest=manifest, products=products,
    )
