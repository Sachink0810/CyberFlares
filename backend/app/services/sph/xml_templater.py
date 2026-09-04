"""
Fill the DualSPHysics Case_Def.xml template.

The critical piece: derive the inlet box (X_MIN/X_MAX/Y_MIN/Y_MAX/Z_MIN/Z_MAX)
automatically from the STL/DEM metadata and the requested breach position.

Strategy for the inlet box (approximate, works for a first pass):
  * Horizontal extent: a square centered on the breach point in local (X,Y)
    coordinates, side = inlet_width_m (default 40 m — comparable to a real
    breach opening).
  * Vertical extent: from Z_min at the breach cell up to Z_min + H_w metres
    (water surface at the moment of breach initiation).

For real cases the user is expected to nudge the inlet in the GUI later; for
automated runs this is a sane starting geometry.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from jinja2 import Template

TEMPLATE_PATH = Path(__file__).parent / "case_template.xml"


def _breach_cell_elevation(
    tiff_path: str | Path,
    center_lat: float,
    center_lon: float,
    breach_lat: float | None,
    breach_lon: float | None,
    sample_radius_km: float = 0.05,  # 50 m around the breach point
) -> float:
    """Median elevation of a small window around the breach point."""
    lat = breach_lat if breach_lat is not None else center_lat
    lon = breach_lon if breach_lon is not None else center_lon
    buf = sample_radius_km / 111.32
    with rasterio.open(tiff_path) as src:
        window = from_bounds(lon - buf, lat - buf, lon + buf, lat + buf, src.transform)
        arr = src.read(1, window=window).astype(float)
        if src.nodata is not None:
            arr = arr[arr != src.nodata]
    if arr.size == 0:
        return 0.0
    return float(np.median(arr))


def compute_inlet_box(
    dem_metadata: dict[str, Any],
    tiff_path: str | Path,
    H_w: float,
    breach_lat: float | None = None,
    breach_lon: float | None = None,
    inlet_width_m: float = 40.0,
) -> dict[str, float]:
    """
    Return {x_min, x_max, y_min, y_max, z_min, z_max} in local Cartesian metres
    matching the STL's coordinate frame.
    """
    center_lat = dem_metadata["center_lat"]
    center_lon = dem_metadata["center_lon"]

    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * np.cos(np.radians(center_lat))

    # Local X,Y of the breach point (the STL is offset so that min_lon,min_lat -> (0,0)).
    # The STL was built from a bbox centered on (center_lat, center_lon) with buffer
    # radius_km, so min_lon = center_lon - buffer_deg, min_lat = center_lat - buffer_deg.
    buffer_deg = dem_metadata["radius_km"] / 111.32
    min_lon = center_lon - buffer_deg
    min_lat = center_lat - buffer_deg

    b_lat = breach_lat if breach_lat is not None else center_lat
    b_lon = breach_lon if breach_lon is not None else center_lon

    cx = (b_lon - min_lon) * m_per_deg_lon
    cy = (b_lat - min_lat) * m_per_deg_lat

    z_bed = _breach_cell_elevation(tiff_path, center_lat, center_lon,
                                   breach_lat, breach_lon)

    half = inlet_width_m / 2.0
    return {
        "x_min": round(cx - half, 3),
        "x_max": round(cx + half, 3),
        "y_min": round(cy - half, 3),
        "y_max": round(cy + half, 3),
        "z_min": round(z_bed, 3),
        "z_max": round(z_bed + H_w, 3),
    }


def render_case_xml(
    output_path: str | Path,
    stl_filename: str,
    hydrograph_filename: str,
    inlet_box: dict[str, float],
    dp: float = 2.0,
    time_max: float = 7200.0,
    time_out: float = 60.0,
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tpl = Template(TEMPLATE_PATH.read_text(encoding="utf-8"))
    xml = tpl.render(
        generated_date=date.today().isoformat(),
        stl_filename=stl_filename,
        hydrograph_filename=hydrograph_filename,
        inlet=inlet_box,
        dp=dp,
        time_max=time_max,
        time_out=time_out,
    )
    output_path.write_text(xml, encoding="utf-8")
    return output_path
