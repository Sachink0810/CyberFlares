"""
Saberi & Zenz (2015) breach hydrograph — headless, importable.

Refactor of the original `saberi_zenz_hydrograph.py` script:
  * no matplotlib
  * no top-level execution
  * returns a dict of arrays + peak/duration
  * optional CSV export

Reference:
  Saberi, O. & Zenz, G. (2015). "Empirical Relationship for Calculate Outflow
  Hydrograph of the Embankment Dam Breaching Due to Overtopping Failure",
  Int. J. Hydraulic Engineering, 4(3).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.interpolate import make_interp_spline


def compute_hydrograph(
    H_w: float,
    V_w_mcm: float,
    delta: float = 1.0,
    alpha: float = 0.1,
    beta: float = 1.0,
    num_points: int = 200,
    write_csv: bool = False,
    csv_path: str | Path | None = None,
) -> dict[str, Any]:
    """
    Parameters
    ----------
    H_w        : height of water at breach (m)
    V_w_mcm    : reservoir volume at breach (million m^3)
    delta      : soil/dam factor. 1.0 = highly erodible / no core,
                 ~1.5–2.0 = clay core / low erodibility.
    alpha      : width ratio of peak plateau. Saberi & Zenz suggest 0.1.
    beta       : height ratio of triangular transitions. Suggest 1.0.
    num_points : discretization density of the returned smoothed hydrograph.
    write_csv  : if True, write the smoothed series to csv_path.
    """
    V_w_m3 = V_w_mcm * 1e6
    ratio = V_w_mcm / H_w

    # --- Breach formation time t_f (Eq. 3 & 4) ------------------------------
    if ratio <= 1.0:
        t_f_hours = delta * (0.1214 * np.log(ratio) + 0.79)
    else:
        t_f_hours = delta * (0.5063 * np.log(ratio) + 0.85)

    # Guard against non-physical (negative) small-ratio results.
    t_f_hours = max(t_f_hours, 0.05)
    t_f_sec = t_f_hours * 3600.0

    # --- Peak discharge Q_p (Eq. 9) ----------------------------------------
    shape_factor = 2 * alpha + beta - (alpha * beta)
    Q_p = (2 * V_w_m3) / (t_f_sec * shape_factor)

    # --- Smoothed inflow curve --------------------------------------------
    t1 = ((1 - alpha) / 2) * t_f_sec
    t2 = ((1 + alpha) / 2) * t_f_sec

    t_ctrl = np.array([0, 0.25 * t_f_sec, t1, 0.5 * t_f_sec,
                       t2, 0.75 * t_f_sec, t_f_sec])
    q_ctrl = np.array([0, 0.65 * Q_p, Q_p * 0.98, Q_p,
                       Q_p * 0.98, 0.65 * Q_p, 0])

    t_smooth = np.linspace(0, t_f_sec, num_points)
    spline = make_interp_spline(t_ctrl, q_ctrl, k=3)
    q_smooth = np.maximum(0, spline(t_smooth))

    # Mass-balance so ∫ Q dt == V_w exactly.
    area = np.trapz(q_smooth, t_smooth)
    if area > 0:
        q_smooth *= V_w_m3 / area

    result: dict[str, Any] = {
        "peak_discharge_m3s": float(np.max(q_smooth)),
        "breach_time_seconds": float(t_f_sec),
        "breach_time_hours": float(t_f_hours),
        "t_seconds": t_smooth.round(2).tolist(),
        "discharge_m3s": q_smooth.round(2).tolist(),
        "params": {
            "H_w": H_w, "V_w_mcm": V_w_mcm,
            "delta": delta, "alpha": alpha, "beta": beta,
        },
    }

    if write_csv:
        if csv_path is None:
            raise ValueError("csv_path required when write_csv=True")
        csv_path = Path(csv_path)
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame({
            "Time_Seconds": np.round(t_smooth, 2),
            "Time_Hours": np.round(t_smooth / 3600.0, 4),
            "Discharge_m3s": np.round(q_smooth, 2),
        }).to_csv(csv_path, index=False)
        result["csv_path"] = str(csv_path)

    return result
