import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.interpolate import make_interp_spline

# -------------------------------------------------------------
# Machchhu-II Dam Baseline Parameters
# -------------------------------------------------------------
H_w = 22.6                  # Height of water at breach (m)
V_w_mcm = 101.0             # Reservoir volume at breach (Million m^3)
V_w_m3 = V_w_mcm * 1e6      # Reservoir volume in m^3

# Model Calibration Parameters (Saberi & Zenz 2015, Tables 2 & 4)
delta = 1.0                 # Soil/dam factor: 1.0 (high erodibility/no core) to 1.5-2.0 (core/low erodibility)
alpha = 0.1                 # Width ratio of peak plateau (suggested: 0.1)
beta = 1.0                  # Height ratio of triangular transitions (suggested: 1.0)

# -------------------------------------------------------------
# 1. Breach Formation Time (t_f) - Equations 3 & 4
# -------------------------------------------------------------
ratio = V_w_mcm / H_w

if ratio <= 1.0:
    t_f_hours = delta * (0.1214 * np.log(ratio) + 0.79)
else:
    t_f_hours = delta * (0.5063 * np.log(ratio) + 0.85)

t_f_sec = t_f_hours * 3600

# -------------------------------------------------------------
# 2. Peak Discharge (Q_p) - Equation 9
# -------------------------------------------------------------
shape_factor = 2 * alpha + beta - (alpha * beta)
Q_p = (2 * V_w_m3) / (t_f_sec * shape_factor)

print("=" * 55)
print("SABERI & ZENZ (2015) DAM BREACH CALCULATIONS")
print("=" * 55)
print(f"Volume / Height Ratio (Vw/Hw) : {ratio:.3f}")
print(f"Dam Type Factor (delta)        : {delta}")
print(f"Breach Formation Time (t_f)    : {t_f_hours:.2f} hours ({t_f_sec:.1f} s)")
print(f"Peak Outflow Discharge (Q_p)   : {Q_p:,.2f} m^3/s")
print("=" * 55)

# -------------------------------------------------------------
# 3. Hydrograph Generation (Geometric & Smoothed)
# -------------------------------------------------------------
# Key temporal boundaries
t1 = ((1 - alpha) / 2) * t_f_sec
t2 = ((1 + alpha) / 2) * t_f_sec

# Discrete points of the piecewise geometric simplified model (Figure 5)
t_geom = np.array([0, t1, t1, t2, t2, t_f_sec])
q_geom = np.array([0, beta * Q_p, Q_p, Q_p, beta * Q_p, 0])

# Smooth continuous representation (Figure 6, dashed curve)
# Sample points: start, rise midpoint, peak start, peak center, peak end, falling midpoint, end
t_ctrl = np.array([0, 0.25 * t_f_sec, t1, 0.5 * t_f_sec, t2, 0.75 * t_f_sec, t_f_sec])
q_ctrl = np.array([0, 0.65 * Q_p, Q_p * 0.98, Q_p, Q_p * 0.98, 0.65 * Q_p, 0])

# Spline interpolation to generate a smooth 200-step time series
t_smooth = np.linspace(0, t_f_sec, 200)
spline = make_interp_spline(t_ctrl, q_ctrl, k=3)
q_smooth = np.maximum(0, spline(t_smooth))

# Scale smoothed curve area so it matches exactly the reservoir storage V_w
current_area = np.trapz(q_smooth, t_smooth)
q_smooth = q_smooth * (V_w_m3 / current_area)

# -------------------------------------------------------------
# 4. Export Time-Series Data
# -------------------------------------------------------------
df_out = pd.DataFrame({
    'Time_Seconds': np.round(t_smooth, 2),
    'Time_Hours': np.round(t_smooth / 3600, 4),
    'Discharge_m3s': np.round(q_smooth, 2)
})

csv_filename = "Machchhu_II_Saberi_Zenz_Hydrograph.csv"
df_out.to_csv(csv_filename, index=False)
print(f"Hydrograph exported successfully to: {csv_filename}")

# -------------------------------------------------------------
# 5. Plot Comparison
# -------------------------------------------------------------
plt.figure(figsize=(10, 5))
plt.plot(t_geom / 3600, q_geom, 'k--', alpha=0.5, label='Saberi & Zenz Geometric Primitives')
plt.plot(df_out['Time_Hours'], df_out['Discharge_m3s'], 'r-', linewidth=2.2, label='Smoothed Inflow Hydrograph (Input to Physics Engines)')
plt.fill_between(df_out['Time_Hours'], df_out['Discharge_m3s'], color='red', alpha=0.15)

plt.title('Machchhu-II Outflow Hydrograph (Saberi & Zenz 2015 Formulation)')
plt.xlabel('Time (Hours)')
plt.ylabel('Discharge ($m^3/s$)')
plt.grid(True, linestyle=':', alpha=0.7)
plt.legend()
plt.tight_layout()
plt.show()