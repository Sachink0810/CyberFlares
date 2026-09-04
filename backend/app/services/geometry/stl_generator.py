"""
Convert a cropped GeoTIFF DEM into a watertight STL (top surface + bottom +
four side walls) in Cartesian meters centred on the origin. Consumable by
DualSPHysics' GenCase.

Refactor of the original `stl_generator.py`: split into (a) `build_mesh`
which returns the numpy array of triangles and useful metadata, and (b)
`generate_nearfield_stl` which saves it to disk. This lets other services
(e.g. the DualSPHysics XML templater) query the terrain bounds without
re-reading the STL.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from stl import mesh


def build_mesh(
    tiff_path: str | Path,
    center_lat: float,
    center_lon: float,
    radius_km: float = 5.0,
    base_height: float = -10.0,
) -> tuple[np.ndarray, dict[str, Any]]:
    buffer_deg = radius_km / 111.32
    min_lon, max_lon = center_lon - buffer_deg, center_lon + buffer_deg
    min_lat, max_lat = center_lat - buffer_deg, center_lat + buffer_deg

    with rasterio.open(tiff_path) as src:
        window = from_bounds(min_lon, min_lat, max_lon, max_lat, src.transform)
        elevation = src.read(1, window=window).astype(np.float32)
        transform = src.window_transform(window)
        if src.nodata is not None:
            elevation[elevation == src.nodata] = np.nanmin(elevation)

    rows, cols = elevation.shape

    c_grid, r_grid = np.meshgrid(np.arange(cols), np.arange(rows))
    lon, lat = transform * (c_grid, r_grid)

    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * np.cos(np.radians(center_lat))

    X = (lon - np.min(lon)) * m_per_deg_lon
    Y = (lat - np.min(lat)) * m_per_deg_lat
    Z = elevation

    # --- Top surface (two tris per cell) ---------------------------------
    v0 = np.stack([X[:-1, :-1], Y[:-1, :-1], Z[:-1, :-1]], axis=-1).reshape(-1, 3)
    v1 = np.stack([X[:-1, 1:],  Y[:-1, 1:],  Z[:-1, 1:]],  axis=-1).reshape(-1, 3)
    v2 = np.stack([X[1:, :-1],  Y[1:, :-1],  Z[1:, :-1]],  axis=-1).reshape(-1, 3)
    v3 = np.stack([X[1:, 1:],   Y[1:, 1:],   Z[1:, 1:]],   axis=-1).reshape(-1, 3)
    top_t1 = np.stack([v0, v1, v2], axis=1)
    top_t2 = np.stack([v1, v3, v2], axis=1)

    # --- Bottom surface ---------------------------------------------------
    zb = np.full_like(Z, base_height)
    b0 = np.stack([X[:-1, :-1], Y[:-1, :-1], zb[:-1, :-1]], axis=-1).reshape(-1, 3)
    b1 = np.stack([X[:-1, 1:],  Y[:-1, 1:],  zb[:-1, 1:]],  axis=-1).reshape(-1, 3)
    b2 = np.stack([X[1:, :-1],  Y[1:, :-1],  zb[1:, :-1]],  axis=-1).reshape(-1, 3)
    b3 = np.stack([X[1:, 1:],   Y[1:, 1:],   zb[1:, 1:]],   axis=-1).reshape(-1, 3)
    bot_t1 = np.stack([b0, b2, b1], axis=1)
    bot_t2 = np.stack([b1, b2, b3], axis=1)

    # --- Side walls (N, S, W, E) -----------------------------------------
    def _wall(top_a, top_b, bot_a, bot_b, flip=False):
        if flip:
            t1 = np.stack([top_a, top_b, bot_a], axis=1)
            t2 = np.stack([top_b, bot_b, bot_a], axis=1)
        else:
            t1 = np.stack([top_a, bot_a, top_b], axis=1)
            t2 = np.stack([top_b, bot_a, bot_b], axis=1)
        return t1, t2

    def _edge(idx_row=None, idx_col=None):
        # Extract a 1-D array of edge points as (n,3) top/bottom pairs.
        if idx_row is not None:
            xt = np.stack([X[idx_row, :-1], Y[idx_row, :-1], Z[idx_row, :-1]], -1)
            xn = np.stack([X[idx_row, 1:],  Y[idx_row, 1:],  Z[idx_row, 1:]],  -1)
            xb = np.stack([X[idx_row, :-1], Y[idx_row, :-1], zb[idx_row, :-1]], -1)
            xnb = np.stack([X[idx_row, 1:],  Y[idx_row, 1:],  zb[idx_row, 1:]],  -1)
        else:
            xt = np.stack([X[:-1, idx_col], Y[:-1, idx_col], Z[:-1, idx_col]], -1)
            xn = np.stack([X[1:,  idx_col], Y[1:,  idx_col], Z[1:,  idx_col]], -1)
            xb = np.stack([X[:-1, idx_col], Y[:-1, idx_col], zb[:-1, idx_col]], -1)
            xnb = np.stack([X[1:,  idx_col], Y[1:,  idx_col], zb[1:,  idx_col]], -1)
        return xt, xn, xb, xnb

    nw = _edge(idx_row=0);   nw_t1, nw_t2 = _wall(*nw, flip=False)
    sw = _edge(idx_row=-1);  sw_t1, sw_t2 = _wall(*sw, flip=True)
    ww = _edge(idx_col=0);   ww_t1, ww_t2 = _wall(*ww, flip=True)
    ew = _edge(idx_col=-1);  ew_t1, ew_t2 = _wall(*ew, flip=False)

    all_faces = np.concatenate([
        top_t1, top_t2, bot_t1, bot_t2,
        nw_t1, nw_t2, sw_t1, sw_t2,
        ww_t1, ww_t2, ew_t1, ew_t2,
    ], axis=0)

    metadata = {
        "rows": rows, "cols": cols,
        "x_min": float(X.min()), "x_max": float(X.max()),
        "y_min": float(Y.min()), "y_max": float(Y.max()),
        "z_min": float(Z.min()), "z_max": float(Z.max()),
        "base_height": base_height,
        "center_lat": center_lat, "center_lon": center_lon,
        "radius_km": radius_km,
    }
    return all_faces, metadata


def generate_nearfield_stl(
    tiff_path: str | Path,
    stl_path: str | Path,
    center_lat: float,
    center_lon: float,
    radius_km: float = 5.0,
    base_height: float = -10.0,
) -> dict[str, Any]:
    faces, meta = build_mesh(tiff_path, center_lat, center_lon,
                             radius_km=radius_km, base_height=base_height)
    stl_path = Path(stl_path)
    stl_path.parent.mkdir(parents=True, exist_ok=True)

    final = mesh.Mesh(np.zeros(faces.shape[0], dtype=mesh.Mesh.dtype))
    final.vectors = faces
    final.save(str(stl_path))

    meta["stl_path"] = str(stl_path)
    meta["facet_count"] = int(faces.shape[0])
    return meta
