import rasterio
from rasterio.windows import from_bounds

# 1. Define Paths
input_tif = "famdeb_data/N22E070_FABDEM_V1-2.tif"
output_tif = "Machchhu_NearField_5km.tif"

# 2. Calculate Bounding Box for 5km Radius
center_lat, center_lon = 22.763, 70.865
buffer_deg = 5.0 / 111.32  # Convert 5km to geographic degrees

min_lon, max_lon = center_lon - buffer_deg, center_lon + buffer_deg
min_lat, max_lat = center_lat - buffer_deg, center_lat + buffer_deg

print(f"Cropping FABDEM to bounding box:\nLon: {min_lon:.3f} to {max_lon:.3f}\nLat: {min_lat:.3f} to {max_lat:.3f}")

# 3. Extract Window and Save
with rasterio.open(input_tif) as src:
    # Map the geographic coordinates to pixel indices
    window = from_bounds(min_lon, min_lat, max_lon, max_lat, src.transform)
    
    # Read only the data within the bounding box
    out_image = src.read(window=window)
    out_transform = src.window_transform(window)
    
    # Update the spatial metadata for the new, smaller file
    out_meta = src.meta.copy()
    out_meta.update({
        "height": out_image.shape[1],
        "width": out_image.shape[2],
        "transform": out_transform
    })

# 4. Write to Disk
with rasterio.open(output_tif, "w", **out_meta) as dest:
    dest.write(out_image)

print(f"Success! Cropped raster saved to: {output_tif}")