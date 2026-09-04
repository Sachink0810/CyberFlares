"""
Crop a global / regional DEM (FABDEM tile, CartoDEM, SRTM) to a bbox around
the dam site. Returns the path of the written GeoTIFF.
"""
from pathlib import Path
import rasterio
from rasterio.windows import from_bounds


def crop_dem(
    input_tif: str | Path,
    output_tif: str | Path,
    center_lat: float,
    center_lon: float,
    radius_km: float = 5.0,
) -> Path:
    output_tif = Path(output_tif)
    output_tif.parent.mkdir(parents=True, exist_ok=True)

    buffer_deg = radius_km / 111.32
    min_lon = center_lon - buffer_deg
    max_lon = center_lon + buffer_deg
    min_lat = center_lat - buffer_deg
    max_lat = center_lat + buffer_deg

    with rasterio.open(input_tif) as src:
        window = from_bounds(min_lon, min_lat, max_lon, max_lat, src.transform)
        out_image = src.read(window=window)
        out_transform = src.window_transform(window)
        out_meta = src.meta.copy()
        out_meta.update({
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform,
        })

    with rasterio.open(output_tif, "w", **out_meta) as dst:
        dst.write(out_image)

    return output_tif
