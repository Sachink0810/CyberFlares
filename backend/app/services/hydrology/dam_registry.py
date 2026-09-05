"""
Seed registry of major Indian dams.

Values are hand-curated from public sources (CWC / India-WRIS / Wikipedia)
and rounded to sensible precision. This module is a stand-in for the full
India-WRIS live fetch — we'll replace it with a real client in a later
phase; the API contract stays the same.

Each entry carries enough info to seed the Saberi & Zenz breach preview:
    H_w (m)    — height of water at breach (~ full-supply level)
    V_w_mcm    — reservoir volume at breach (million m^3)
    delta      — soil erodibility factor (1.0 highly erodible / rock-fill
                 or earth-fill, 1.5-2.0 concrete gravity or clay-core)
"""
from typing import Any

REGISTRY: list[dict[str, Any]] = [
    # ── Reference & historic breach cases (baked into the demo) ──
    {"id": "machchhu-ii", "name": "Machchhu-II", "state": "Gujarat",
     "river": "Machchhu", "type": "Earth-fill embankment",
     "dam_lat": 22.763, "dam_lon": 70.865,
     "H_w": 22.6, "V_w_mcm": 101.0, "delta": 1.0,
     "note": "Historic 1979 breach; reference case for our pipeline."},

    {"id": "rishi-ganga-glof", "name": "Rishi Ganga GLOF site", "state": "Uttarakhand",
     "river": "Rishi Ganga", "type": "Natural landslide / ice",
     "dam_lat": 30.371, "dam_lon": 79.723,
     "H_w": 40.0, "V_w_mcm": 20.0, "delta": 0.7,
     "note": "Feb 2021 rock-ice avalanche — GLOF test bed for SPH."},

    {"id": "kosi-barrage", "name": "Kosi Barrage", "state": "Bihar",
     "river": "Kosi", "type": "Embankment",
     "dam_lat": 26.512, "dam_lon": 86.917,
     "H_w": 8.0, "V_w_mcm": 150.0, "delta": 1.5,
     "note": "2008 embankment breach — Delft3D far-field test bed."},

    # ── Major dams across India ──
    {"id": "tehri", "name": "Tehri Dam", "state": "Uttarakhand",
     "river": "Bhagirathi", "type": "Rock-fill",
     "dam_lat": 30.377, "dam_lon": 78.480,
     "H_w": 260.0, "V_w_mcm": 3540.0, "delta": 1.0,
     "note": "Tallest dam in India."},

    {"id": "bhakra", "name": "Bhakra Dam", "state": "Himachal Pradesh",
     "river": "Sutlej", "type": "Concrete gravity",
     "dam_lat": 31.410, "dam_lon": 76.433,
     "H_w": 207.0, "V_w_mcm": 9868.0, "delta": 1.8},

    {"id": "sardar-sarovar", "name": "Sardar Sarovar", "state": "Gujarat",
     "river": "Narmada", "type": "Concrete gravity",
     "dam_lat": 21.831, "dam_lon": 73.749,
     "H_w": 163.0, "V_w_mcm": 9500.0, "delta": 1.8},

    {"id": "hirakud", "name": "Hirakud Dam", "state": "Odisha",
     "river": "Mahanadi", "type": "Composite",
     "dam_lat": 21.523, "dam_lon": 83.867,
     "H_w": 61.0, "V_w_mcm": 8136.0, "delta": 1.3},

    {"id": "nagarjuna-sagar", "name": "Nagarjuna Sagar", "state": "Telangana",
     "river": "Krishna", "type": "Masonry gravity",
     "dam_lat": 16.575, "dam_lon": 79.312,
     "H_w": 124.0, "V_w_mcm": 11472.0, "delta": 1.6},

    {"id": "indira-sagar", "name": "Indira Sagar", "state": "Madhya Pradesh",
     "river": "Narmada", "type": "Concrete gravity",
     "dam_lat": 22.283, "dam_lon": 76.483,
     "H_w": 92.0, "V_w_mcm": 12220.0, "delta": 1.8},

    {"id": "ukai", "name": "Ukai Dam", "state": "Gujarat",
     "river": "Tapi", "type": "Composite",
     "dam_lat": 21.253, "dam_lon": 73.590,
     "H_w": 68.0, "V_w_mcm": 8510.0, "delta": 1.3},

    {"id": "krs", "name": "Krishna Raja Sagara", "state": "Karnataka",
     "river": "Kaveri", "type": "Masonry gravity",
     "dam_lat": 12.418, "dam_lon": 76.567,
     "H_w": 39.0, "V_w_mcm": 1400.0, "delta": 1.6},

    {"id": "mettur", "name": "Mettur Dam", "state": "Tamil Nadu",
     "river": "Kaveri", "type": "Masonry gravity",
     "dam_lat": 11.786, "dam_lon": 77.798,
     "H_w": 65.0, "V_w_mcm": 2647.0, "delta": 1.6},

    {"id": "idukki", "name": "Idukki Dam", "state": "Kerala",
     "river": "Periyar", "type": "Arch dam",
     "dam_lat": 9.845, "dam_lon": 76.972,
     "H_w": 169.0, "V_w_mcm": 1996.0, "delta": 2.0},

    {"id": "koyna", "name": "Koyna Dam", "state": "Maharashtra",
     "river": "Koyna", "type": "Rubble concrete gravity",
     "dam_lat": 17.401, "dam_lon": 73.751,
     "H_w": 103.0, "V_w_mcm": 2836.0, "delta": 1.7},

    {"id": "rihand", "name": "Rihand Dam", "state": "Uttar Pradesh",
     "river": "Rihand", "type": "Concrete gravity",
     "dam_lat": 24.202, "dam_lon": 83.019,
     "H_w": 91.0, "V_w_mcm": 8600.0, "delta": 1.8},

    {"id": "gandhi-sagar", "name": "Gandhi Sagar", "state": "Madhya Pradesh",
     "river": "Chambal", "type": "Masonry gravity",
     "dam_lat": 24.708, "dam_lon": 75.548,
     "H_w": 62.0, "V_w_mcm": 7746.0, "delta": 1.5},

    {"id": "srisailam", "name": "Srisailam Dam", "state": "Andhra Pradesh",
     "river": "Krishna", "type": "Masonry gravity",
     "dam_lat": 16.083, "dam_lon": 78.900,
     "H_w": 145.0, "V_w_mcm": 8722.0, "delta": 1.6},

    {"id": "supa", "name": "Supa Dam", "state": "Karnataka",
     "river": "Kali", "type": "Concrete gravity",
     "dam_lat": 15.198, "dam_lon": 74.598,
     "H_w": 101.0, "V_w_mcm": 4177.0, "delta": 1.7},
]


def list_dams() -> list[dict[str, Any]]:
    """Return all seeded dams."""
    return REGISTRY


def get_dam(dam_id: str) -> dict[str, Any] | None:
    """Return a single dam by id, or None if not found."""
    return next((d for d in REGISTRY if d["id"] == dam_id), None)
