import rasterio
from rasterio.windows import from_bounds
import numpy as np
from stl import mesh

def generate_nearfield_stl(tiff_path, stl_path, center_lat, center_lon, radius_km=5.0, base_height=-10.0):
    # 1. Calculate Bounding Box (1 degree ~ 111.32 km)
    buffer_deg = radius_km / 111.32
    min_lon, max_lon = center_lon - buffer_deg, center_lon + buffer_deg
    min_lat, max_lat = center_lat - buffer_deg, center_lat + buffer_deg
    
    print(f"Cropping FABDEM to 5km radius...")
    
    # 2. Extract strictly the bounded window into RAM
    with rasterio.open(tiff_path) as src:
        window = from_bounds(min_lon, min_lat, max_lon, max_lat, src.transform)
        elevation = src.read(1, window=window)
        transform = src.window_transform(window)
        
        nodata = src.nodata
        if nodata is not None:
            elevation[elevation == nodata] = np.nanmin(elevation)
            
    rows, cols = elevation.shape
    print(f"Cropped Grid resolution: {cols}x{rows}")

    # 3. Project Geographic Degrees to Cartesian Meters (Centered at Origin)
    c_grid, r_grid = np.meshgrid(np.arange(cols), np.arange(rows))
    lon, lat = transform * (c_grid, r_grid)

    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * np.cos(np.radians(center_lat))

    X = (lon - np.min(lon)) * m_per_deg_lon
    Y = (lat - np.min(lat)) * m_per_deg_lat
    Z = elevation
    
    print("Vectorizing watertight mesh arrays...")
    
    # --- TOP SURFACE ---
    v0 = np.stack([X[:-1, :-1], Y[:-1, :-1], Z[:-1, :-1]], axis=-1).reshape(-1, 3)
    v1 = np.stack([X[:-1, 1:], Y[:-1, 1:], Z[:-1, 1:]], axis=-1).reshape(-1, 3)
    v2 = np.stack([X[1:, :-1], Y[1:, :-1], Z[1:, :-1]], axis=-1).reshape(-1, 3)
    v3 = np.stack([X[1:, 1:], Y[1:, 1:], Z[1:, 1:]], axis=-1).reshape(-1, 3)

    top_t1 = np.stack([v0, v1, v2], axis=1)
    top_t2 = np.stack([v1, v3, v2], axis=1)
    
    # --- BOTTOM SURFACE ---
    b0 = np.stack([X[:-1, :-1], Y[:-1, :-1], np.full_like(Z[:-1, :-1], base_height)], axis=-1).reshape(-1, 3)
    b1 = np.stack([X[:-1, 1:], Y[:-1, 1:], np.full_like(Z[:-1, 1:], base_height)], axis=-1).reshape(-1, 3)
    b2 = np.stack([X[1:, :-1], Y[1:, :-1], np.full_like(Z[1:, :-1], base_height)], axis=-1).reshape(-1, 3)
    b3 = np.stack([X[1:, 1:], Y[1:, 1:], np.full_like(Z[1:, 1:], base_height)], axis=-1).reshape(-1, 3)
    
    bot_t1 = np.stack([b0, b2, b1], axis=1)
    bot_t2 = np.stack([b1, b2, b3], axis=1)
    
    # --- SIDE WALLS ---
    nw_v0_t, nw_v1_t = np.stack([X[0, :-1], Y[0, :-1], Z[0, :-1]], axis=-1), np.stack([X[0, 1:], Y[0, 1:], Z[0, 1:]], axis=-1)
    nw_v0_b, nw_v1_b = np.stack([X[0, :-1], Y[0, :-1], np.full_like(Z[0, :-1], base_height)], axis=-1), np.stack([X[0, 1:], Y[0, 1:], np.full_like(Z[0, 1:], base_height)], axis=-1)
    nw_t1, nw_t2 = np.stack([nw_v0_t, nw_v0_b, nw_v1_t], axis=1), np.stack([nw_v1_t, nw_v0_b, nw_v1_b], axis=1)

    sw_v0_t, sw_v1_t = np.stack([X[-1, :-1], Y[-1, :-1], Z[-1, :-1]], axis=-1), np.stack([X[-1, 1:], Y[-1, 1:], Z[-1, 1:]], axis=-1)
    sw_v0_b, sw_v1_b = np.stack([X[-1, :-1], Y[-1, :-1], np.full_like(Z[-1, :-1], base_height)], axis=-1), np.stack([X[-1, 1:], Y[-1, 1:], np.full_like(Z[-1, 1:], base_height)], axis=-1)
    sw_t1, sw_t2 = np.stack([sw_v0_t, sw_v1_t, sw_v0_b], axis=1), np.stack([sw_v1_t, sw_v1_b, sw_v0_b], axis=1)

    ww_v0_t, ww_v1_t = np.stack([X[:-1, 0], Y[:-1, 0], Z[:-1, 0]], axis=-1), np.stack([X[1:, 0], Y[1:, 0], Z[1:, 0]], axis=-1)
    ww_v0_b, ww_v1_b = np.stack([X[:-1, 0], Y[:-1, 0], np.full_like(Z[:-1, 0], base_height)], axis=-1), np.stack([X[1:, 0], Y[1:, 0], np.full_like(Z[1:, 0], base_height)], axis=-1)
    ww_t1, ww_t2 = np.stack([ww_v0_t, ww_v1_t, ww_v0_b], axis=1), np.stack([ww_v1_t, ww_v1_b, ww_v0_b], axis=1)

    ew_v0_t, ew_v1_t = np.stack([X[:-1, -1], Y[:-1, -1], Z[:-1, -1]], axis=-1), np.stack([X[1:, -1], Y[1:, -1], Z[1:, -1]], axis=-1)
    ew_v0_b, ew_v1_b = np.stack([X[:-1, -1], Y[:-1, -1], np.full_like(Z[:-1, -1], base_height)], axis=-1), np.stack([X[1:, -1], Y[1:, -1], np.full_like(Z[1:, -1], base_height)], axis=-1)
    ew_t1, ew_t2 = np.stack([ew_v0_t, ew_v0_b, ew_v1_t], axis=1), np.stack([ew_v1_t, ew_v0_b, ew_v1_b], axis=1)
    
    # 4. Combine and save
    all_faces = np.concatenate([
        top_t1, top_t2, bot_t1, bot_t2,
        nw_t1, nw_t2, sw_t1, sw_t2,
        ww_t1, ww_t2, ew_t1, ew_t2
    ], axis=0)
    
    print(f"Compiling {all_faces.shape[0]} facets...")
    final_mesh = mesh.Mesh(np.zeros(all_faces.shape[0], dtype=mesh.Mesh.dtype))
    final_mesh.vectors = all_faces
    
    final_mesh.save(stl_path)
    print(f"Success! Saved to {stl_path}.")

# Execute for Machchhu-II (Center: 22.763 N, 70.865 E)
generate_nearfield_stl("Machchhu_NearField_5km.tif", "Machchhu_Watertight.stl", 22.763, 70.865, radius_km=5.0)