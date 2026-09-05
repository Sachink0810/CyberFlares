#!/usr/bin/env python3
"""
NRT FLOOD ANALYSIS ENGINE v3
============================
Sentinel-1 SAR flood inundation mapping on Google Earth Engine.

Method follows Markert et al. (2020), Remote Sensing 12(15):2469 ("Comparing
Sentinel-1 Surface Water Mapping Algorithms and Radiometric Terrain Correction
Processing in Southeast Asia Utilizing Google Earth Engine"), using Edge Otsu
(Donchyts et al.) as the primary thresholding algorithm and a tiled-bimodality
Otsu (the Bmax-Otsu concept of Cao et al.) as an independent cross-check.

------------------------------------------------------------------------------
CHANGES FROM v2 -- every one of these fixes a defect, not a preference
------------------------------------------------------------------------------

A. Acquisition
   A1. REMOVED the hardcoded `orbitProperties_pass == 'DESCENDING'` filter.
       It was redundant: a relativeOrbitNumber IS a single track, and every
       track is either ascending or descending, so locking the orbit already
       guarantees a consistent look geometry. Worse, it was harmful: it
       discarded half the candidate tracks *before* orbit selection, and with
       a ~6-12 day per-track revisit a short crisis window on one descending
       track can easily contain zero images. For NRT flood response, latency
       dominates -- you want the first usable overpass, whichever direction
       it came from. Pass direction is now a CLI option defaulting to AUTO,
       and the pass actually used is recorded in the run manifest.
   A1b. --pass-direction BOTH. AUTO still resolves to a SINGLE track (a
       relative orbit number belongs to exactly one pass, and Otsu/median
       compositing need one consistent incidence angle -- mixing ascending
       and descending imagery into one composite would reintroduce the same
       contamination the DESCENDING-only filter was removed to fix). BOTH is
       the properly-engineered way to always use both passes: it runs two
       independent, internally-consistent pipelines (own orbit selection,
       own composite, own Edge Otsu threshold per pass, each archived in the
       manifest under "passes") and takes the UNION of the two resulting
       flood masks. This is a real technique, not a workaround: a flood pixel
       hidden by layover/shadow in one viewing geometry is frequently visible
       in the other, so the union recovers detections either pass alone would
       miss. If only one pass has usable imagery, BOTH degrades gracefully to
       that single pass and says so in the manifest ("fusion":
       "single_pass_fallback:..."). Costs roughly 2x the Earth Engine calls of
       AUTO/single-pass.
   A2. Orbit is now SELECTED, not taken as `orbit_list.get(0)` (arbitrary).
       Candidate tracks are scored on AOI coverage first, then image count,
       then recency, and the full scoring table goes into the manifest.
   A3. Empty-collection guards. v2 called `.get(0)` on a possibly-empty orbit
       list and composited a possibly-empty collection, producing an opaque
       EE error or silent garbage.
   A4. `min()` compositing removed entirely. min() cherry-picks the darkest
       observation per pixel and therefore systematically over-detects water
       and amplifies speckle spikes. Now: median (n>=3), mean (n==2), the
       single image (n==1), with the choice recorded.

B. Thresholding
   B1. FIXED `ee.Reducer.histogram(255, 2)`. The second argument is
       minBucketWidth -- 2 dB. Over a ~25 dB VV range that is ~13 buckets, so
       the Otsu threshold was quantised to 2 dB. Water/land separation in VV
       is often only 3-5 dB, so this alone could dominate the error budget and
       undo the entire Edge Otsu upgrade. Now 0.1 dB (configurable).
   B2. Otsu is computed CLIENT-SIDE in numpy from the fetched histogram.
       The v2 ee.Array implementation was correct but opaque, could not be
       validated, and crashed on a null histogram. The histogram is a few KB
       and was already being pulled via getInfo(), so this costs nothing,
       is unit-testable, and lets the histogram be archived in the manifest
       as evidence for the chosen threshold.
   B3. FIXED the Bmax cross-check, which was broken three ways in v2:
         - `aoi.coveringGrid(aoi.projection().crs(), 0.1 * 111320)` asked for
           11,132-DEGREE tiles, because a Rectangle's projection is EPSG:4326
           and the scale argument is then in degrees. Now uses a local UTM CRS.
         - `ee.Algorithms.If(cond, calc(), ...)` -- calc() is a Python call and
           is therefore evaluated eagerly every time, so the guard did nothing.
           Removed; the tiled reduction is a single reduceRegions.
         - `bmax = p*(1-p)*4` is class balance, not bimodality, and had no
           relation to Cao et al. The metric is now the honest one: the
           normalised between-class variance at the Otsu split,
           eta = sigma_B^2 / sigma_T^2, which is 1.0 for a perfectly separated
           bimodal histogram and near 0 for a unimodal one.
   B4. Bimodality diagnostics are reported for the primary threshold, and a
       weak-bimodality warning is raised when they fail. A threshold from a
       unimodal histogram is meaningless and the run should say so rather than
       emitting a confident-looking map. Critically, the gate is NOT raw Otsu
       eta: eta has a floor of 2/pi ~= 0.637 for any unimodal distribution
       (splitting a single Gaussian at its mean already scores 0.64), so an
       "eta > 0.6" test passes pure noise. The engine reports raw eta for
       comparability with the literature but gates on a floor-corrected
       bimodality index plus Ashman's D.
   B5. Plausibility clamp: a threshold falling outside a physically sensible
       VV water range is flagged (and optionally rejected) instead of used.

C. Edge Otsu internals
   C1. The 1500 m circular `focal_max` (a ~100 px radius kernel, thousands of
       pixels per output pixel) is replaced by `fastDistanceTransform` +
       threshold. Same buffer, orders of magnitude cheaper; the old kernel was
       the most likely cause of a timeout during a live demo.
   C2. Canny and connectedPixelCount are resolution-dependent, so the seed
       mask is now explicitly `.reproject()`-ed to a fixed local UTM grid at
       the analysis scale. In v2 the edges used for the histogram and the
       edges implied by the map display could differ.
   C3. `bestEffort=True` on the threshold reduction is gone. bestEffort
       silently coarsens the scale when the pixel budget is exceeded, so the
       same AOI could yield a different threshold on different runs -- fatal
       for a "computer-verified boundary" claim. Scale is now explicit and an
       over-budget request fails loudly with actionable advice.

D. Speckle filter
   D1. `reduceNeighborhood` emits `VV_mean` / `VV_variance`; v2 then did
       `natural.subtract(mean)` across mismatched band names and relied on
       Earth Engine's fallback band-matching. Every intermediate is now
       explicitly renamed.
   D2. Renamed to what it is -- a simplified adaptive Lee filter, not
       Lee-Sigma (no sigma-range preselection, no directional sub-windows).

E. Change detection
   E1. v2's change-detection path was dead on arrival: the difference image is
       centred near 0 dB, but the Edge Otsu seed was still
       `image.lt(-16)`, which selects nothing -> no edges -> empty histogram ->
       crash. The seed threshold is now mode-dependent.
   E2. Optional conjunctive rule: a pixel is flood only if it BOTH darkened
       significantly relative to its own baseline AND is dark enough in
       absolute terms to be water. This is what separates real flooding from
       permanently/seasonally wet paddy in places like Kuttanad, and is the
       main scientific answer to "is this just the normal wet season?".
   E3. Baseline availability is checked rather than assumed.

F. Masking and outputs
   F1. Built-up areas are NO LONGER DELETED. v2's `.updateMask(not_urban)`
       made it structurally impossible to report inundated settlements --
       which is the output disaster-relief authorities care about most. SAR is
       genuinely unreliable over urban fabric (layover, double bounce,
       shadow), so urban detections are now emitted as a SEPARATE, explicitly
       low-confidence layer with its own area figure.
   F2. Explicit band naming throughout the area reduction; v2 multiplied a
       'VV' band by an 'area' band and read back 'VV', relying on EE's
       band-naming fallback.
   F3. Outputs now include ESRI Shapefile and KML alongside GeoJSON, as the
       problem statement requires, plus a machine-readable run manifest
       (parameters, orbit, image IDs, threshold, separability, histogram,
       areas) so any result can be reproduced and audited.
   F4. `input()` prompts replaced by argparse (`--interactive` preserves the
       old flow), so the engine can be scheduled, called from a backend, or
       driven by a test harness. `run(config)` is importable.
   F5. `ee.batch` export path for AOIs too large for interactive getInfo().

------------------------------------------------------------------------------
KNOWN LIMITATIONS (stated, not hidden)
------------------------------------------------------------------------------
  * No RTC (Radiometric Terrain Correction) source is wired in, because no
    public ready-to-use RTC ImageCollection exists in the GEE catalog. The
    paper found RTC to be the single largest accuracy/stability gain
    (~94-95% vs ~92-94%, and roughly half the run-to-run standard deviation).
    If you have an RTC collection (ASF HyP3, pyroSAR/OpenSARToolkit, or your
    own SNAP output as an EE asset), pass it with --collection.
  * Single-date mode cannot distinguish flood from normal seasonal
    inundation. Use --change-detection for any region with seasonal water.
  * SAR misses flooding under dense canopy and inside dense urban fabric;
    the tree-cover mask and the separate urban layer make that explicit
    rather than pretending otherwise.
  * The tiled Otsu is a cross-check on the Edge Otsu threshold, not an
    independent validation. Real validation needs optical or in-situ
    reference data.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

try:
    import ee
except ImportError:  # pragma: no cover
    print("earthengine-api is required:  pip install earthengine-api", file=sys.stderr)
    raise

LOG = logging.getLogger("nrt_flood")


# ==============================================================================
# Configuration
# ==============================================================================

@dataclass
class Config:
    # --- identity / AOI ---
    # No dummy values here on purpose. Every run of v2 silently defaulted to
    # "sih-flood-engine-123456" / Kuttanad / Aug 2026 whenever a flag was
    # omitted, which is exactly how someone ends up generating a real-looking
    # flood map for the wrong place. These are required: parse_args() (CLI)
    # and interactive_config() (prompts) both refuse to proceed with any of
    # them still None -- see require_identity() below.
    project_id: Optional[str] = None
    event_name: Optional[str] = None
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    radius_km: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    # --- imagery ---
    collection: str = "COPERNICUS/S1_GRD"
    polarisation: str = "VV"            # VV or VH
    pass_direction: str = "AUTO"        # AUTO | ASCENDING | DESCENDING | BOTH
    orbit_number: Optional[int] = None  # force a specific relative orbit
    min_orbit_coverage: float = 0.90    # fraction of AOI a track must cover
    widen_days_if_empty: int = 6        # auto-widen the window if nothing found

    # --- scales ---
    scale: int = 20                     # analysis scale (m); S1 GRD IW is 10 m
    hist_scale: int = 30                # scale for histogram reductions (m)
    vector_scale: int = 30              # scale for reduceToVectors (m)

    # --- speckle filter ---
    lee_kernel_px: int = 7
    lee_enl: float = 4.9                # equivalent number of looks, S1 IW GRD

    # --- Edge Otsu ---
    seed_threshold_db: float = -16.0    # seed for the absolute-backscatter mode
    seed_threshold_change_db: float = -3.0   # seed for the change-detection mode
    canny_threshold: float = 0.7
    canny_sigma: float = 1.0
    min_edge_length_m: int = 200
    edge_buffer_m: int = 1500

    # --- histogram / Otsu ---
    max_buckets: int = 512
    min_bucket_width: float = 0.1       # dB  (v2 had 2.0 -- see change note B1)
    min_hist_samples: int = 500
    # Gate on the floor-corrected bimodality index, NOT on raw Otsu eta:
    # eta has a floor of 2/pi ~= 0.64 even for a single Gaussian, so any
    # "eta > 0.6" style test passes unimodal noise. See UNIMODAL_ETA_FLOOR.
    min_bimodality: float = 0.20
    min_ashman_d: float = 3.0

    # --- tiled (Bmax-style) cross-check ---
    run_cross_check: bool = True
    tile_size_m: int = 10000
    tile_min_bimodality: float = 0.25
    cross_check_tolerance_db: float = 2.0

    # --- plausibility clamp ---
    plausible_threshold_db: Tuple[float, float] = (-30.0, -8.0)
    plausible_change_db: Tuple[float, float] = (-12.0, -1.0)
    reject_implausible: bool = False    # True = abort; False = warn and continue

    # --- change detection ---
    change_detection: bool = False
    baseline_days_before: int = 45
    baseline_gap_days: int = 2
    require_absolute_water: bool = True
    absolute_water_db: float = -14.0    # used with require_absolute_water

    # --- terrain / land-cover constraints ---
    hand_threshold_m: float = 30.0
    permanent_water_seasonality: int = 10   # months/yr in GSW to call permanent
    exclude_tree_cover: bool = True
    urban_as_separate_layer: bool = True    # v2 deleted urban outright

    # --- vectorising ---
    min_polygon_pixels: int = 4

    # --- outputs ---
    outdir: str = "."
    make_map: bool = True
    write_shapefile: bool = True
    write_kml: bool = True
    export_to_drive: bool = False
    drive_folder: str = "nrt_flood_engine"

    def band(self) -> str:
        return self.polarisation.upper()


REQUIRED_IDENTITY_FIELDS = (
    "project_id", "event_name", "center_lat", "center_lon", "radius_km",
    "start_date", "end_date",
)


def require_identity(cfg: Config) -> None:
    """Refuse to run with any placeholder/unset identity field.

    This is the single choke point that guarantees every run used real,
    user-supplied AOI and date information rather than falling through to a
    baked-in example region.
    """
    missing = [f for f in REQUIRED_IDENTITY_FIELDS if getattr(cfg, f) in (None, "")]
    if missing:
        raise RuntimeError(
            "Missing required input(s): {}. Supply them as CLI flags "
            "(--project-id, --event-name, --lat, --lon, --radius-km, --start, "
            "--end) or run with --interactive to be prompted.".format(
                ", ".join(missing)
            )
        )
    if not (-90.0 <= cfg.center_lat <= 90.0):
        raise RuntimeError("Latitude {} is out of range [-90, 90].".format(cfg.center_lat))
    if not (-180.0 <= cfg.center_lon <= 180.0):
        raise RuntimeError("Longitude {} is out of range [-180, 180].".format(cfg.center_lon))
    if cfg.radius_km <= 0:
        raise RuntimeError("Radius must be positive, got {}.".format(cfg.radius_km))
    try:
        start = datetime.strptime(cfg.start_date, "%Y-%m-%d")
        end = datetime.strptime(cfg.end_date, "%Y-%m-%d")
    except ValueError as exc:
        raise RuntimeError("Dates must be YYYY-MM-DD: {}".format(exc)) from exc
    if end < start:
        raise RuntimeError(
            "End date {} is before start date {}.".format(cfg.end_date, cfg.start_date)
        )


# ==============================================================================
# Geodesy helpers
# ==============================================================================

def utm_crs_for(lat: float, lon: float) -> str:
    """Local UTM CRS so that 'metres' really are metres.

    v2 used the AOI's own EPSG:4326 projection for coveringGrid, which made the
    tile size a number of DEGREES. It also implicitly used Web-Mercator-ish
    metres elsewhere, which are inflated by 1/cos(lat).
    """
    zone = int((lon + 180.0) // 6.0) + 1
    zone = max(1, min(60, zone))
    return "EPSG:{}".format((32600 if lat >= 0 else 32700) + zone)


def bbox_from_radius(lat: float, lon: float, radius_km: float) -> "ee.Geometry":
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * math.cos(math.radians(lat)))
    return ee.Geometry.Rectangle(
        [lon - dlon, lat - dlat, lon + dlon, lat + dlat], proj="EPSG:4326", geodesic=False
    )


# ==============================================================================
# Otsu core -- client-side, unit-testable, no Earth Engine dependency
# ==============================================================================

# Otsu's separability eta = sigma_B^2 / sigma_T^2 does NOT go to zero for a
# unimodal distribution. Splitting a single Gaussian at its own mean gives
# class means at +/- sqrt(2/pi)*sigma and class variances of (1 - 2/pi)*sigma^2,
# so eta = 2/pi ~= 0.6366. That is the FLOOR, not a sign of bimodality -- an
# empirical unimodal histogram will score around 0.64 and sail past any naive
# "eta > 0.6" test. Reported eta is therefore floor-corrected into a bimodality
# index that really is ~0 for one mode and ~1 for two separated modes.
UNIMODAL_ETA_FLOOR = 2.0 / math.pi


def otsu_from_histogram(
    counts: Sequence[float], means: Sequence[float]
) -> Optional[Dict[str, float]]:
    """Otsu's threshold plus honest bimodality diagnostics.

    Returns a dict with:
        threshold    -- the cut value (midpoint between the two bucket means
                        straddling the split, which is more accurate than
                        returning a bucket centre as v2 did)
        separability -- raw eta = sigma_B^2 / sigma_T^2, in [0, 1]. Reported
                        because it is what the literature quotes, but see the
                        floor note above: do not threshold decisions on it.
        bimodality   -- (eta - 2/pi) / (1 - 2/pi), clamped to [0, 1]. ~0 for a
                        single mode, ~1 for two well-separated modes. This is
                        the number to gate on, and the honest version of what
                        v2 called "bmax" (which actually measured class
                        balance and had no relation to Cao et al.).
        ashman_d     -- sqrt(2)*|mu_A - mu_B| / sqrt(var_A + var_B); separation
                        expressed in units of the classes' own spread. Its
                        floor for a split unimodal Gaussian is ~2.65, so values
                        near or below that mean "one mode, cut arbitrarily".
        n            -- total sample count
    None if the histogram is empty or degenerate.
    """
    c = np.asarray(counts, dtype=np.float64).ravel()
    m = np.asarray(means, dtype=np.float64).ravel()
    if c.size != m.size or c.size < 3:
        return None
    total = float(c.sum())
    if total <= 0:
        return None

    order = np.argsort(m)
    c, m = c[order], m[order]

    cum_w = np.cumsum(c)                # weight of class A = buckets [0..i]
    cum_s = np.cumsum(c * m)
    total_sum = float(cum_s[-1])
    grand_mean = total_sum / total

    wA = cum_w[:-1]
    wB = total - wA
    valid = (wA > 0) & (wB > 0)
    if not np.any(valid):
        return None

    sA = cum_s[:-1]
    with np.errstate(invalid="ignore", divide="ignore"):
        mA = np.where(wA > 0, sA / np.where(wA > 0, wA, 1.0), 0.0)
        mB = np.where(wB > 0, (total_sum - sA) / np.where(wB > 0, wB, 1.0), 0.0)

    # sigma_B^2 = p_A * p_B * (mu_A - mu_B)^2
    bcv = (wA / total) * (wB / total) * (mA - mB) ** 2
    bcv = np.where(valid, bcv, -1.0)

    idx = int(np.argmax(bcv))
    threshold = float(0.5 * (m[idx] + m[idx + 1]))

    total_var = float((c * (m - grand_mean) ** 2).sum() / total)
    separability = float(bcv[idx] / total_var) if total_var > 0 else 0.0
    separability = max(0.0, min(1.0, separability))

    bimodality = (separability - UNIMODAL_ETA_FLOOR) / (1.0 - UNIMODAL_ETA_FLOOR)
    bimodality = max(0.0, min(1.0, bimodality))

    # Within-class spreads at the chosen split, for Ashman's D.
    lo, hi = slice(0, idx + 1), slice(idx + 1, None)
    wA_i, wB_i = float(c[lo].sum()), float(c[hi].sum())
    muA, muB = float(mA[idx]), float(mB[idx])
    varA = float((c[lo] * (m[lo] - muA) ** 2).sum() / wA_i) if wA_i > 0 else 0.0
    varB = float((c[hi] * (m[hi] - muB) ** 2).sum() / wB_i) if wB_i > 0 else 0.0
    spread = math.sqrt(varA + varB)
    ashman_d = float(math.sqrt(2.0) * abs(muA - muB) / spread) if spread > 0 else 0.0

    return {
        "threshold": threshold,
        "separability": separability,
        "bimodality": bimodality,
        "ashman_d": ashman_d,
        "class_means": [muA, muB],
        "n": total,
    }


def parse_ee_histogram(obj: Any) -> Optional[Tuple[List[float], List[float]]]:
    """Pull (counts, means) out of an Earth Engine histogram dictionary.

    reduceRegion with a single unnamed reducer keys the result by band name, so
    callers hand us the inner dict; reduceRegions sometimes nests it under
    'histogram'. Both shapes are accepted, and None (no valid pixels) returns
    None rather than exploding -- v2 crashed here.
    """
    if obj is None:
        return None
    if isinstance(obj, dict) and "bucketMeans" in obj and "histogram" in obj:
        return list(obj["histogram"]), list(obj["bucketMeans"])
    if isinstance(obj, dict):
        for value in obj.values():
            found = parse_ee_histogram(value)
            if found is not None:
                return found
    return None


# ==============================================================================
# Earth Engine building blocks
# ==============================================================================

def analysis_projection(cfg: Config) -> "ee.Projection":
    return ee.Projection(utm_crs_for(cfg.center_lat, cfg.center_lon)).atScale(cfg.scale)


def lee_filter(image: "ee.Image", cfg: Config) -> "ee.Image":
    """Simplified adaptive Lee speckle filter, applied in the linear domain.

    SAR speckle is multiplicative, so filtering must not be done on dB values.
    Every intermediate is explicitly renamed: reduceNeighborhood emits
    '<band>_mean' / '<band>_variance', and v2 then subtracted images with
    mismatched band names, relying on Earth Engine's fallback matching.

    This is NOT Refined Lee or Lee-Sigma -- there is no sigma-range
    preselection and no directional sub-window edge detection. For production,
    prefer a full implementation (SNAP, or the gee_s1_ard community pipeline).
    """
    band = cfg.band()
    natural = ee.Image(10.0).pow(image.select(band).divide(10.0)).rename("nat")
    kernel = ee.Kernel.square(max(1, cfg.lee_kernel_px // 2), "pixels")

    mean = natural.reduceNeighborhood(ee.Reducer.mean(), kernel).rename("mean")
    variance = natural.reduceNeighborhood(ee.Reducer.variance(), kernel).rename("var")

    noise_var = mean.pow(2).divide(cfg.lee_enl).rename("nvar")
    weight = variance.divide(variance.add(noise_var)).rename("w")
    filtered = mean.add(weight.multiply(natural.subtract(mean))).rename("filt")

    # filtered lies between mean and the observed value, both strictly > 0,
    # so log10 is always defined here.
    return ee.Image(10.0).multiply(filtered.log10()).rename(band)


def edge_strip_mask(image: "ee.Image", cfg: Config, seed_db: float) -> "ee.Image":
    """Buffered strip around detected water/land edges (Donchyts et al.).

    Sampling the histogram only along the water/land boundary keeps it
    genuinely bimodal -- water versus its immediately adjacent land -- instead
    of letting a large permanent water body or the dominant land cover skew a
    scene-wide histogram.

    Two implementation notes:
      * Earth Engine's reduceToVectors has no 'polyline' output, so the paper's
        vector length filter and vector buffer are done in raster space:
        connectedPixelCount drops short edge fragments, and a distance
        transform buffers the survivors.
      * The 1500 m circular focal_max used in v2 is a ~100 px radius kernel and
        is extremely expensive. fastDistanceTransform gives the identical
        buffer at a tiny fraction of the cost.
      * Everything is reprojected to a fixed grid: Canny and connectedPixelCount
        are resolution-dependent, so without this the edges depend on whatever
        pyramid level a given request happens to resolve to.
    """
    proj = analysis_projection(cfg)

    seed = image.lt(seed_db).rename("water").reproject(proj)

    # Canny on the binary water guess, not the raw dB image -- this avoids
    # picking up texture edges from urban fabric or forest.
    edges = (
        ee.Algorithms.CannyEdgeDetector(seed, cfg.canny_threshold, cfg.canny_sigma)
        .gt(0)
        .rename("edge")
        .selfMask()
        .reproject(proj)
    )

    min_px = max(1, int(round(cfg.min_edge_length_m / float(cfg.scale))))
    search_cap = int(min(1024, max(64, min_px * 8)))
    connected = edges.connectedPixelCount(maxSize=search_cap, eightConnected=True)
    long_edges = edges.updateMask(connected.gte(min_px)).unmask(0).reproject(proj)

    buffer_px = cfg.edge_buffer_m / float(cfg.scale)
    neighbourhood = int(min(1024, 2 ** math.ceil(math.log2(max(16.0, buffer_px + 8.0)))))
    dist_px = long_edges.fastDistanceTransform(
        neighbourhood, "pixels", "squared_euclidean"
    ).sqrt()

    return dist_px.multiply(cfg.scale).lte(cfg.edge_buffer_m).selfMask().rename("strip")


def fetch_histogram(
    image: "ee.Image", cfg: Config, geometry: "ee.Geometry"
) -> Optional[Tuple[List[float], List[float]]]:
    """Deterministic histogram reduction.

    bestEffort is deliberately OFF: it silently coarsens the scale when the
    pixel budget is exceeded, which makes the resulting threshold irreproducible
    between runs on the same AOI.
    """
    band = cfg.band()
    reducer = ee.Reducer.histogram(cfg.max_buckets, cfg.min_bucket_width)
    try:
        result = image.select(band).reduceRegion(
            reducer=reducer,
            geometry=geometry,
            scale=cfg.hist_scale,
            bestEffort=False,
            maxPixels=1e10,
            tileScale=4,
        ).getInfo()
    except Exception as exc:  # noqa: BLE001 - EEException surface varies
        raise RuntimeError(
            "Histogram reduction failed ({}). The AOI is probably too large for "
            "the requested scale. Increase --hist-scale (currently {} m) or "
            "reduce --radius-km, rather than enabling bestEffort, which would "
            "make the threshold irreproducible.".format(exc, cfg.hist_scale)
        ) from exc
    return parse_ee_histogram(result)


def edge_otsu(
    image: "ee.Image", cfg: Config, aoi: "ee.Geometry", seed_db: float
) -> Dict[str, Any]:
    """Primary threshold: Otsu over the buffered water/land edge strip."""
    strip = edge_strip_mask(image, cfg, seed_db)
    sampled = image.select(cfg.band()).updateMask(strip)
    hist = fetch_histogram(sampled, cfg, aoi)
    if hist is None:
        raise RuntimeError(
            "Edge Otsu found no valid pixels. Either the seed threshold "
            "({:.1f} dB) selected nothing -- check that it matches the analysis "
            "mode -- or there is no water/land boundary in the AOI.".format(seed_db)
        )
    counts, means = hist
    result = otsu_from_histogram(counts, means)
    if result is None:
        raise RuntimeError("Edge Otsu histogram was degenerate (fewer than 3 buckets).")
    result["algorithm"] = "edge_otsu"
    result["histogram"] = {"counts": counts, "bucketMeans": means}
    return result


def tiled_otsu(
    image: "ee.Image", cfg: Config, aoi: "ee.Geometry"
) -> Optional[Dict[str, Any]]:
    """Cross-check: Otsu restricted to tiles that are actually bimodal.

    This is the Bmax-Otsu idea of Cao et al. -- fewer parameters than Edge Otsu
    and more transferable, so a large disagreement between the two is a strong
    signal that the primary threshold should not be trusted.

    v2's version was unusable: degree-sized tiles, an eagerly-evaluated
    ee.Algorithms.If guard, and a "bmax" that measured class balance rather
    than bimodality.
    """
    band = cfg.band()
    crs = utm_crs_for(cfg.center_lat, cfg.center_lon)
    grid = aoi.coveringGrid(ee.Projection(crs), cfg.tile_size_m)

    reduced = image.select(band).reduceRegions(
        collection=grid,
        reducer=ee.Reducer.histogram(cfg.max_buckets, cfg.min_bucket_width),
        scale=cfg.hist_scale,
        tileScale=4,
    )
    try:
        info = reduced.getInfo()
    except Exception as exc:  # noqa: BLE001
        LOG.warning("Tiled cross-check reduction failed: %s", exc)
        return None

    kept: List[Dict[str, Any]] = []
    scores: List[float] = []
    for feature in info.get("features", []):
        hist = parse_ee_histogram(feature.get("properties", {}))
        if hist is None:
            continue
        stats = otsu_from_histogram(*hist)
        if stats is None or stats["n"] < cfg.min_hist_samples:
            continue
        scores.append(stats["bimodality"])
        if stats["bimodality"] >= cfg.tile_min_bimodality:
            kept.append(feature)

    if not kept:
        LOG.warning(
            "Tiled cross-check: no tile reached bimodality >= %.2f "
            "(best was %.2f of %d tiles). Skipping cross-check.",
            cfg.tile_min_bimodality,
            max(scores) if scores else 0.0,
            len(scores),
        )
        return None

    sample_geom = ee.FeatureCollection(
        [ee.Feature(ee.Geometry(f["geometry"])) for f in kept]
    ).geometry(maxError=1)

    hist = fetch_histogram(image, cfg, sample_geom)
    if hist is None:
        return None
    stats = otsu_from_histogram(*hist)
    if stats is None:
        return None
    stats["algorithm"] = "tiled_otsu"
    stats["tiles_used"] = len(kept)
    stats["tiles_total"] = len(scores)
    return stats


# ==============================================================================
# Acquisition
# ==============================================================================

def base_collection(
    cfg: Config, aoi: "ee.Geometry", pass_filter: Optional[str] = None
) -> "ee.ImageCollection":
    """`pass_filter` overrides cfg.pass_direction for one call -- used by BOTH
    mode to fetch the ascending and descending candidate pools separately.
    With no override, AUTO applies no filter (score_orbits then picks
    whichever single track is best, ascending or descending) and
    ASCENDING/DESCENDING/BOTH resolve as named. See change note A1."""
    coll = (
        ee.ImageCollection(cfg.collection)
        .filterBounds(aoi)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", cfg.band()))
        .select(cfg.band())
    )
    effective = (pass_filter or cfg.pass_direction).upper()
    if effective in ("ASCENDING", "DESCENDING"):
        coll = coll.filter(ee.Filter.eq("orbitProperties_pass", effective))
    return coll


def score_orbits(
    coll: "ee.ImageCollection", aoi: "ee.Geometry", cfg: Config
) -> List[Dict[str, Any]]:
    """Score every candidate relative orbit in one round trip.

    v2 took `orbit_list.get(0)` -- an arbitrary track that might barely clip the
    AOI. Coverage is the first criterion because a track that only touches a
    corner of the AOI is useless no matter how many images it has.
    """
    orbits = coll.aggregate_array("relativeOrbitNumber_start").distinct().sort()

    def stats(orbit):
        orbit = ee.Number(orbit)
        sub = coll.filter(ee.Filter.eq("relativeOrbitNumber_start", orbit))
        coverage = (
            sub.mosaic().mask().rename("m").reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=aoi,
                scale=300,
                maxPixels=1e9,
                bestEffort=True,
            ).get("m")
        )
        return ee.Feature(
            None,
            {
                "orbit": orbit,
                "n": sub.size(),
                "coverage": ee.Number(ee.Algorithms.If(coverage, coverage, 0)),
                "pass": ee.String(sub.first().get("orbitProperties_pass")),
                "latest": ee.Date(sub.aggregate_max("system:time_start")).format(
                    "YYYY-MM-dd"
                ),
            },
        )

    info = ee.FeatureCollection(orbits.map(stats)).getInfo()
    rows = [f["properties"] for f in info.get("features", [])]
    rows.sort(
        key=lambda r: (
            r.get("coverage", 0) >= cfg.min_orbit_coverage,
            round(r.get("coverage", 0), 3),
            r.get("n", 0),
            r.get("latest", ""),
        ),
        reverse=True,
    )
    return rows


def select_orbit(rows: List[Dict[str, Any]], cfg: Config) -> Dict[str, Any]:
    if not rows:
        raise RuntimeError("No Sentinel-1 images match the AOI, dates and filters.")
    if cfg.orbit_number is not None:
        for row in rows:
            if int(row["orbit"]) == int(cfg.orbit_number):
                return row
        raise RuntimeError(
            "Requested orbit {} is not among the available tracks: {}".format(
                cfg.orbit_number, [int(r["orbit"]) for r in rows]
            )
        )
    best = rows[0]
    if best.get("coverage", 0) < cfg.min_orbit_coverage:
        LOG.warning(
            "Best track %s covers only %.0f%% of the AOI (wanted >= %.0f%%). "
            "The map will be incomplete outside that footprint.",
            int(best["orbit"]),
            100 * best.get("coverage", 0),
            100 * cfg.min_orbit_coverage,
        )
    return best


def composite(coll: "ee.ImageCollection", n: int, aoi: "ee.Geometry") -> Tuple["ee.Image", str]:
    """Composite the crisis window.

    min() is never used: it takes the darkest observation at each pixel, which
    systematically over-detects water and is maximally sensitive to speckle
    spikes -- the opposite of what a robust estimator should do.
    """
    if n >= 3:
        return coll.median().clip(aoi), "median"
    if n == 2:
        return coll.mean().clip(aoi), "mean"
    return coll.mosaic().clip(aoi), "single_image"


# ==============================================================================
# Masks
# ==============================================================================

def build_masks(cfg: Config, aoi: "ee.Geometry") -> Dict[str, "ee.Image"]:
    """Terrain, permanent water and land-cover constraints.

    HAND (Height Above Nearest Drainage) rather than slope: in flat deltaic
    terrain slope is near zero everywhere regardless of flood risk, so a slope
    filter barely constrains anything, whereas HAND encodes vertical proximity
    to the nearest drainage channel, which is what actually predicts
    flood-proneness in low relief.
    """
    hand = ee.Image("MERIT/Hydro/v1_0_1").select("hnd")
    terrain = hand.lt(cfg.hand_threshold_m).unmask(0).rename("terrain").clip(aoi)

    permanent = (
        ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
        .select("seasonality")
        .gte(cfg.permanent_water_seasonality)
        .unmask(0)
        .rename("permanent")
        .clip(aoi)
    )

    worldcover = (
        ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").clip(aoi)
    )
    tree = worldcover.eq(10).rename("tree")
    urban = worldcover.eq(50).rename("urban")

    return {
        "terrain": terrain,
        "permanent": permanent,
        "tree": tree,
        "urban": urban,
        "worldcover": worldcover,
    }


def classify(
    water_raw: "ee.Image", masks: Dict[str, "ee.Image"], cfg: Config
) -> Dict[str, "ee.Image"]:
    """Split detections into a high-confidence layer and an urban layer.

    v2 did `.updateMask(not_urban)`, which deleted urban detections entirely and
    made it impossible for the product to report inundated settlements -- the
    single most operationally important output. SAR really is unreliable over
    built-up areas (layover, double bounce, radar shadow), so those detections
    are separated and flagged rather than discarded.
    """
    base = (
        water_raw.rename("flood")
        .updateMask(masks["permanent"].Not())
        .updateMask(masks["terrain"])
    )
    if cfg.exclude_tree_cover:
        base = base.updateMask(masks["tree"].Not())

    if cfg.urban_as_separate_layer:
        open_flood = base.updateMask(masks["urban"].Not()).selfMask().rename("flood")
        urban_flood = base.updateMask(masks["urban"]).selfMask().rename("flood_urban")
    else:
        open_flood = base.updateMask(masks["urban"].Not()).selfMask().rename("flood")
        urban_flood = None

    return {"open": open_flood, "urban": urban_flood}


def area_hectares(image: "ee.Image", aoi: "ee.Geometry", cfg: Config) -> float:
    """Explicitly named bands throughout -- v2 multiplied 'VV' by 'area' and
    then read back 'VV', relying on Earth Engine's band-naming fallback."""
    if image is None:
        return 0.0
    area_img = image.gt(0).rename("m").multiply(ee.Image.pixelArea()).rename("area")
    total = area_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=aoi,
        scale=cfg.scale,
        maxPixels=1e10,
        tileScale=4,
    ).get("area").getInfo()
    return float(total) / 10000.0 if total else 0.0


# ==============================================================================
# Output writers
# ==============================================================================

def vectorise(image: "ee.Image", aoi: "ee.Geometry", cfg: Config) -> "ee.FeatureCollection":
    return (
        image.gt(0)
        .rename("flood")
        .reduceToVectors(
            geometry=aoi,
            scale=cfg.vector_scale,
            geometryType="polygon",
            eightConnected=True,   # 8-connectivity keeps diagonally adjacent
                                   # patches together instead of shattering them
            maxPixels=1e10,
            bestEffort=False,
        )
        .filter(ee.Filter.gte("count", cfg.min_polygon_pixels))
    )


def _polygons_from_geojson(geojson: Dict[str, Any]) -> List[List[List[List[float]]]]:
    polys: List[List[List[List[float]]]] = []
    for feature in geojson.get("features", []):
        geom = feature.get("geometry") or {}
        gtype, coords = geom.get("type"), geom.get("coordinates")
        if gtype == "Polygon":
            polys.append(coords)
        elif gtype == "MultiPolygon":
            polys.extend(coords)
    return polys


def write_kml(geojson: Dict[str, Any], path: str, name: str) -> str:
    """Hand-rolled KML writer -- no fiona/LIBKML driver dependency, which is the
    usual reason a KML export fails on a fresh machine five minutes before a
    demo."""
    def ring(coords: List[List[float]]) -> str:
        pts = " ".join("{:.6f},{:.6f},0".format(c[0], c[1]) for c in coords)
        return "<LinearRing><coordinates>{}</coordinates></LinearRing>".format(pts)

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
        "<name>{}</name>".format(name),
        '<Style id="flood"><PolyStyle><color>7fffff00</color></PolyStyle>'
        "<LineStyle><color>ffffff00</color><width>1</width></LineStyle></Style>",
    ]
    for i, poly in enumerate(_polygons_from_geojson(geojson)):
        if not poly:
            continue
        inner = "".join(
            "<innerBoundaryIs>{}</innerBoundaryIs>".format(ring(r)) for r in poly[1:]
        )
        parts.append(
            "<Placemark><name>flood_{}</name><styleUrl>#flood</styleUrl>"
            "<Polygon><outerBoundaryIs>{}</outerBoundaryIs>{}</Polygon>"
            "</Placemark>".format(i, ring(poly[0]), inner)
        )
    parts.append("</Document></kml>")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(parts))
    return path


def write_shapefile(geojson: Dict[str, Any], path: str) -> Optional[str]:
    try:
        import geopandas as gpd  # noqa: PLC0415
    except ImportError:
        LOG.warning(
            "geopandas not installed; skipping shapefile. "
            "Install with `pip install geopandas` or use --export-to-drive, "
            "which produces a shapefile server-side."
        )
        return None
    frame = gpd.GeoDataFrame.from_features(geojson.get("features", []), crs="EPSG:4326")
    if frame.empty:
        LOG.warning("No flood polygons; skipping shapefile.")
        return None
    frame.to_file(path)
    return path


def export_to_drive(
    vectors: "ee.FeatureCollection", image: "ee.Image", aoi: "ee.Geometry", cfg: Config
) -> List[str]:
    tasks = []
    task_v = ee.batch.Export.table.toDrive(
        collection=vectors,
        description="{}_flood_vectors".format(cfg.event_name),
        folder=cfg.drive_folder,
        fileFormat="SHP",
    )
    task_v.start()
    tasks.append(task_v.id)

    task_i = ee.batch.Export.image.toDrive(
        image=image.gt(0).rename("flood").toByte(),
        description="{}_flood_raster".format(cfg.event_name),
        folder=cfg.drive_folder,
        region=aoi,
        scale=cfg.scale,
        crs=utm_crs_for(cfg.center_lat, cfg.center_lon),
        maxPixels=1e13,
    )
    task_i.start()
    tasks.append(task_i.id)
    return tasks


def write_map(
    smoothed: "ee.Image",
    layers: Dict[str, "ee.Image"],
    aoi: "ee.Geometry",
    cfg: Config,
    path: str,
) -> Optional[str]:
    try:
        import geemap  # noqa: PLC0415
    except ImportError:
        LOG.warning("geemap not installed; skipping HTML map.")
        return None
    m = geemap.Map(center=[cfg.center_lat, cfg.center_lon], zoom=11)
    m.add_basemap("SATELLITE")
    m.addLayer(smoothed, {"min": -25, "max": 0}, "SAR {} (filtered)".format(cfg.band()), False)
    m.addLayer(layers["open"], {"palette": ["00FFFF"]}, "Flood (high confidence)", True)
    if layers.get("urban") is not None:
        m.addLayer(
            layers["urban"],
            {"palette": ["FF8C00"]},
            "Flood in built-up area (LOW confidence)",
            True,
        )
    m.addLayer(ee.Image().byte().paint(aoi, 1, 2), {"palette": ["red"]}, "AOI")
    m.to_html(path)
    return path


# ==============================================================================
# Pipeline
# ==============================================================================

def run(cfg: Config) -> Dict[str, Any]:
    require_identity(cfg)
    os.makedirs(cfg.outdir, exist_ok=True)
    manifest: Dict[str, Any] = {
        "engine_version": "3.0",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "config": asdict(cfg),
        "warnings": [],
    }

    def warn(msg: str, *args: Any) -> None:
        text = msg % args if args else msg
        LOG.warning(text)
        manifest["warnings"].append(text)

    LOG.info("[1/9] Initialising Earth Engine (project=%s)", cfg.project_id)
    try:
        ee.Initialize(project=cfg.project_id)
    except Exception:  # noqa: BLE001
        ee.Authenticate()
        ee.Initialize(project=cfg.project_id)

    LOG.info("[2/9] Building AOI (%.1f km radius)", cfg.radius_km)
    aoi = bbox_from_radius(cfg.center_lat, cfg.center_lon, cfg.radius_km)
    masks = build_masks(cfg, aoi)

    def process_pass(
        pass_filter: Optional[str], label: str, required: bool
    ) -> Optional[Dict[str, Any]]:
        """Runs acquisition through classification for ONE geometrically
        consistent population of images: either an explicit pass
        ('ASCENDING'/'DESCENDING', used by BOTH mode) or None, which lets
        score_orbits/select_orbit pick whichever single track is best across
        both passes (AUTO's normal behaviour).

        Deliberately never mixes ascending and descending imagery into one
        composite or one histogram -- that would reintroduce the
        incidence-angle contamination the DESCENDING-only filter was removed
        to fix (see module docstring, change note A1/BOTH). Two calls to this
        function, one per pass, is how BOTH mode gets both without that risk.

        Returns None (rather than raising) when required=False and this pass
        has no usable imagery -- that is what lets BOTH mode fall back to a
        single pass instead of failing the whole run because, say, only
        descending happens to cover this AOI in the crisis window.
        """
        rec: Dict[str, Any] = {}

        def pwarn(msg: str, *args: Any) -> None:
            warn("[{}] {}".format(label, msg), *args)

        def fail(msg: str, *args: Any) -> Optional[Dict[str, Any]]:
            text = msg % args if args else msg
            if required:
                raise RuntimeError("[{}] {}".format(label, text))
            pwarn(text)
            return None

        LOG.info("[3/9] Searching Sentinel-1 (%s, pass=%s)", cfg.band(), label)
        base = base_collection(cfg, aoi, pass_filter)
        crisis = base.filterDate(cfg.start_date, ee.Date(cfg.end_date).advance(1, "day"))

        if crisis.size().getInfo() == 0 and cfg.widen_days_if_empty > 0:
            pwarn(
                "No images in %s..%s; widening the window by %d days each side.",
                cfg.start_date, cfg.end_date, cfg.widen_days_if_empty,
            )
            crisis = base.filterDate(
                ee.Date(cfg.start_date).advance(-cfg.widen_days_if_empty, "day"),
                ee.Date(cfg.end_date).advance(cfg.widen_days_if_empty + 1, "day"),
            )
        if crisis.size().getInfo() == 0:
            return fail(
                "No Sentinel-1 imagery for this AOI and date range on this pass. "
                "Widen the dates, or try --pass-direction AUTO."
            )

        LOG.info("[4/9] Scoring relative orbits (%s)", label)
        rows = score_orbits(crisis, aoi, cfg)
        chosen = select_orbit(rows, cfg)
        orbit = int(chosen["orbit"])
        rec["orbit_candidates"] = rows
        rec["orbit_selected"] = chosen
        LOG.info(
            "      -> orbit %d (%s pass), %d image(s), %.0f%% AOI coverage",
            orbit, chosen.get("pass"), int(chosen.get("n", 0)),
            100 * chosen.get("coverage", 0),
        )

        crisis = crisis.filter(ee.Filter.eq("relativeOrbitNumber_start", orbit))
        n_images = int(crisis.size().getInfo())
        rec["crisis_image_ids"] = crisis.aggregate_array("system:index").getInfo()

        crisis_img, method = composite(crisis, n_images, aoi)
        rec["composite_method"] = method
        rec["crisis_image_count"] = n_images
        if n_images < 3:
            pwarn(
                "Only %d image(s) on this track; composited with %s. Three or "
                "more would allow a median, which is far more robust to speckle.",
                n_images, method,
            )

        LOG.info("[5/9] Speckle filtering (%s, adaptive Lee, %dpx)", label, cfg.lee_kernel_px)
        smoothed = lee_filter(crisis_img, cfg)

        if cfg.change_detection:
            LOG.info("      -> [%s] building pre-flood baseline", label)
            b_end = ee.Date(cfg.start_date).advance(-cfg.baseline_gap_days, "day")
            b_start = b_end.advance(-cfg.baseline_days_before, "day")
            baseline = base.filterDate(b_start, b_end).filter(
                ee.Filter.eq("relativeOrbitNumber_start", orbit)
            )
            n_base = int(baseline.size().getInfo())
            rec["baseline_image_count"] = n_base
            if n_base == 0:
                return fail(
                    "Change detection requested but no baseline imagery exists "
                    "on orbit {} in the {} days before {}. Increase "
                    "--baseline-days-before.".format(
                        orbit, cfg.baseline_days_before, cfg.start_date
                    )
                )
            if n_base < 2:
                pwarn("Baseline has only %d image; it will carry speckle into the ratio.", n_base)
            baseline_img, _ = composite(baseline, n_base, aoi)
            baseline_smoothed = lee_filter(baseline_img, cfg)
            # dB difference == linear ratio. Negative means "darker than
            # normal", i.e. wetter than this pixel's own baseline -- which is
            # what separates real flooding from permanently/seasonally wet
            # paddy.
            analysis = smoothed.subtract(baseline_smoothed).rename(cfg.band())
            seed_db = cfg.seed_threshold_change_db
            plausible = cfg.plausible_change_db
        else:
            analysis = smoothed
            seed_db = cfg.seed_threshold_db
            plausible = cfg.plausible_threshold_db

        rec["mode"] = "change_detection" if cfg.change_detection else "single_date"
        rec["seed_threshold_db"] = seed_db

        LOG.info("[6/9] Edge Otsu threshold (%s, seed %.1f dB)", label, seed_db)
        primary = edge_otsu(analysis, cfg, aoi, seed_db)
        threshold = primary["threshold"]
        rec["threshold"] = {k: v for k, v in primary.items() if k != "histogram"}
        rec["threshold_histogram"] = primary["histogram"]
        LOG.info(
            "      -> [%s] %.2f dB (bimodality %.2f, Ashman D %.2f, eta %.3f, n=%d)",
            label, threshold, primary["bimodality"], primary["ashman_d"],
            primary["separability"], int(primary["n"]),
        )

        if primary["bimodality"] < cfg.min_bimodality or primary["ashman_d"] < cfg.min_ashman_d:
            pwarn(
                "Weak bimodality: index %.2f (need >= %.2f), Ashman D %.2f "
                "(need >= %.2f), classes at %.1f / %.1f dB. The edge-strip "
                "histogram is not clearly two-class, so this threshold is a "
                "cut through noise rather than a water/land boundary. Treat "
                "this pass's output as indicative only.",
                primary["bimodality"], cfg.min_bimodality, primary["ashman_d"],
                cfg.min_ashman_d, primary["class_means"][0], primary["class_means"][1],
            )
        if not (plausible[0] <= threshold <= plausible[1]):
            message = (
                "Threshold {:.2f} dB is outside the plausible range {}. This "
                "usually means the AOI has no real water/land contrast on this "
                "pass, or the mode and seed threshold are mismatched.".format(
                    threshold, plausible
                )
            )
            if cfg.reject_implausible:
                return fail(message)
            pwarn(message)

        if cfg.run_cross_check:
            LOG.info("[7/9] Tiled Otsu cross-check (%s)", label)
            cross = tiled_otsu(analysis, cfg, aoi)
            rec["cross_check"] = cross
            if cross:
                delta = abs(cross["threshold"] - threshold)
                LOG.info(
                    "      -> [%s] %.2f dB on %d/%d bimodal tiles (delta %.2f dB)",
                    label, cross["threshold"], cross["tiles_used"],
                    cross["tiles_total"], delta,
                )
                if delta > cfg.cross_check_tolerance_db:
                    pwarn(
                        "Edge Otsu and tiled Otsu disagree by %.2f dB (> %.2f). "
                        "Inspect the archived histogram before trusting this pass.",
                        delta, cfg.cross_check_tolerance_db,
                    )
        else:
            rec["cross_check"] = None

        LOG.info("[8/9] Applying hydrologic and land-cover constraints (%s)", label)
        water_raw = analysis.select(cfg.band()).lt(threshold)
        if cfg.change_detection and cfg.require_absolute_water:
            # Conjunctive rule: darkened relative to baseline AND actually dark
            # enough to be water. Without this, any pixel that merely got a
            # bit darker (e.g. a harvested field) can pass.
            water_raw = water_raw.And(smoothed.select(cfg.band()).lt(cfg.absolute_water_db))
            rec["absolute_water_db"] = cfg.absolute_water_db

        layers = classify(water_raw, masks, cfg)
        rec["layers"] = layers
        rec["smoothed"] = smoothed

        area_open = area_hectares(layers["open"], aoi, cfg)
        area_urban = area_hectares(layers.get("urban"), aoi, cfg)
        rec["area_hectares"] = {
            "high_confidence": round(area_open, 2),
            "built_up_low_confidence": round(area_urban, 2),
            "total": round(area_open + area_urban, 2),
        }
        LOG.info(
            "      -> [%s] %.2f ha high confidence, %.2f ha in built-up areas",
            label, area_open, area_urban,
        )
        return rec

    if cfg.pass_direction == "BOTH":
        # Two independently thresholded, geometrically consistent pipelines --
        # never a raw ascending+descending composite. required=False on both
        # lets one missing pass degrade gracefully instead of failing the run.
        asc = process_pass("ASCENDING", "ASCENDING", required=False)
        desc = process_pass("DESCENDING", "DESCENDING", required=False)
        results = {k: v for k, v in (("ASCENDING", asc), ("DESCENDING", desc)) if v is not None}
        if not results:
            raise RuntimeError(
                "BOTH mode found no Sentinel-1 imagery on EITHER pass for this "
                "AOI and date range. Widen the dates."
            )
        manifest["passes"] = {
            k: {kk: vv for kk, vv in v.items() if kk not in ("layers", "smoothed")}
            for k, v in results.items()
        }

        if len(results) == 2:
            LOG.info("Fusing ascending + descending flood masks (union)")
            asc_open = results["ASCENDING"]["layers"]["open"].unmask(0)
            desc_open = results["DESCENDING"]["layers"]["open"].unmask(0)
            # Union, not intersection: a flood pixel hidden by layover/shadow
            # in one viewing geometry is often visible in the other, so OR-ing
            # the two independently-thresholded masks recovers detections
            # either pass alone would miss -- this is the actual benefit of
            # "always both", achieved without contaminating either threshold.
            open_layer = asc_open.Or(desc_open).selfMask().rename("flood")

            asc_urban = results["ASCENDING"]["layers"].get("urban")
            desc_urban = results["DESCENDING"]["layers"].get("urban")
            if asc_urban is not None or desc_urban is not None:
                a = asc_urban.unmask(0) if asc_urban is not None else ee.Image(0)
                d = desc_urban.unmask(0) if desc_urban is not None else ee.Image(0)
                urban_layer = a.Or(d).selfMask().rename("flood_urban")
            else:
                urban_layer = None

            smoothed = results["ASCENDING"]["smoothed"]  # for map display only;
            # both passes' own composites/thresholds are archived per-pass above
            manifest["fusion"] = "union(ascending, descending)"
        else:
            only_label, only = next(iter(results.items()))
            warn(
                "BOTH mode requested but only %s-pass imagery was available; "
                "the map reflects that single pass, not a fusion.",
                only_label,
            )
            open_layer = only["layers"]["open"]
            urban_layer = only["layers"].get("urban")
            smoothed = only["smoothed"]
            manifest["fusion"] = "single_pass_fallback:{}".format(only_label)

        layers = {"open": open_layer, "urban": urban_layer}
        area_open = area_hectares(layers["open"], aoi, cfg)
        area_urban = area_hectares(layers.get("urban"), aoi, cfg)
        manifest["area_hectares"] = {
            "high_confidence": round(area_open, 2),
            "built_up_low_confidence": round(area_urban, 2),
            "total": round(area_open + area_urban, 2),
        }
        manifest["threshold_by_pass"] = {
            k: v["threshold"]["threshold"] for k, v in results.items()
        }
        LOG.info(
            "      -> fused: %.2f ha high confidence, %.2f ha in built-up areas",
            area_open, area_urban,
        )
    else:
        rec = process_pass(None, cfg.pass_direction, required=True)
        layers = rec["layers"]
        smoothed = rec["smoothed"]
        manifest.update({k: v for k, v in rec.items() if k not in ("layers", "smoothed")})

    LOG.info("[9/9] Writing outputs")
    outputs: Dict[str, Any] = {}
    prefix = os.path.join(cfg.outdir, cfg.event_name)

    vectors = vectorise(layers["open"], aoi, cfg)
    if cfg.export_to_drive:
        outputs["drive_tasks"] = export_to_drive(vectors, layers["open"], aoi, cfg)
        LOG.info("      -> Drive export tasks started: %s", outputs["drive_tasks"])
    else:
        geojson = vectors.getInfo()
        gj_path = prefix + "_flood.geojson"
        with open(gj_path, "w", encoding="utf-8") as handle:
            json.dump(geojson, handle)
        outputs["geojson"] = gj_path
        manifest["polygon_count"] = len(geojson.get("features", []))

        if cfg.write_shapefile:
            shp = write_shapefile(geojson, prefix + "_flood.shp")
            if shp:
                outputs["shapefile"] = shp
        if cfg.write_kml:
            outputs["kml"] = write_kml(geojson, prefix + "_flood.kml", cfg.event_name)

    if cfg.make_map and not cfg.export_to_drive:
        html = write_map(smoothed, layers, aoi, cfg, prefix + "_map.html")
        if html:
            outputs["map"] = html

    manifest["outputs"] = outputs
    manifest_path = prefix + "_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    outputs["manifest"] = manifest_path

    LOG.info("Done. Manifest: %s", manifest_path)
    if manifest["warnings"]:
        LOG.warning("%d warning(s) recorded in the manifest.", len(manifest["warnings"]))
    return manifest


# ==============================================================================
# CLI
# ==============================================================================

def _prompt_required(prompt: str, cast, validate=None) -> Any:
    """Loop until the user supplies a real, valid value. No default is ever
    offered, so pressing enter re-asks the question rather than silently
    picking a placeholder."""
    while True:
        raw = input("{}: ".format(prompt)).strip()
        if not raw:
            print("  This field is required -- please enter a value.")
            continue
        try:
            value = cast(raw)
        except (ValueError, TypeError) as exc:
            print("  Could not parse '{}': {}".format(raw, exc))
            continue
        if validate is not None:
            error = validate(value)
            if error:
                print("  {}".format(error))
                continue
        return value


def interactive_config(cfg: Config, only_missing: bool = False) -> Config:
    """Prompt for identity/AOI fields. Every value comes from the user in this
    call -- nothing here falls back to a baked-in example region or project.

    With only_missing=True (the default flow when some fields were already
    given on the command line), only the fields the user did NOT supply as
    flags are prompted for; the rest are left exactly as parsed from argv.
    """
    def needed(field: str) -> bool:
        return not only_missing or getattr(cfg, field) in (None, "")

    if needed("project_id"):
        cfg.project_id = _prompt_required("GCP Earth Engine project ID", str)
    if needed("event_name"):
        cfg.event_name = _prompt_required(
            "Event name (used as output file prefix, e.g. Kuttanad_Aug2026)", str
        )
    if needed("center_lat"):
        cfg.center_lat = _prompt_required(
            "Center latitude (decimal degrees, e.g. 9.3833)",
            float,
            lambda v: None if -90.0 <= v <= 90.0 else "Latitude must be between -90 and 90.",
        )
    if needed("center_lon"):
        cfg.center_lon = _prompt_required(
            "Center longitude (decimal degrees, e.g. 76.4333)",
            float,
            lambda v: None if -180.0 <= v <= 180.0 else "Longitude must be between -180 and 180.",
        )
    if needed("radius_km"):
        cfg.radius_km = _prompt_required(
            "Catchment / AOI radius in km",
            float,
            lambda v: None if v > 0 else "Radius must be positive.",
        )
    if needed("start_date"):
        cfg.start_date = _prompt_required(
            "Crisis window start date (YYYY-MM-DD)",
            str,
            lambda v: _date_error(v),
        )
    if needed("end_date"):
        def end_validate(v: str) -> Optional[str]:
            err = _date_error(v)
            if err:
                return err
            if cfg.start_date and datetime.strptime(v, "%Y-%m-%d") < datetime.strptime(
                cfg.start_date, "%Y-%m-%d"
            ):
                return "End date cannot be before the start date ({}).".format(cfg.start_date)
            return None
        cfg.end_date = _prompt_required("Crisis window end date (YYYY-MM-DD)", str, end_validate)

    return cfg


def _date_error(value: str) -> Optional[str]:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return "Dates must be in YYYY-MM-DD format."
    return None


def parse_args(argv: Optional[Sequence[str]] = None) -> Config:
    d = Config()
    p = argparse.ArgumentParser(
        description="Sentinel-1 near-real-time flood inundation mapping (v3).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--interactive", action="store_true",
                   help="prompt for every identity/AOI parameter, even ones "
                        "already given as flags")
    # No defaults on any of these: an AOI, a project and a date range must
    # come from the caller. Anything left unset here is filled in by an
    # interactive prompt (if stdin is a terminal) or causes a clear error
    # before any Earth Engine call is made (see require_identity()).
    p.add_argument("--project-id", default=None, help="GCP Earth Engine project ID")
    p.add_argument("--event-name", default=None, help="output file prefix / run name")
    p.add_argument("--lat", type=float, default=None, help="AOI center latitude")
    p.add_argument("--lon", type=float, default=None, help="AOI center longitude")
    p.add_argument("--radius-km", type=float, default=None, help="AOI radius in km")
    p.add_argument("--start", default=None, help="crisis window start, YYYY-MM-DD")
    p.add_argument("--end", default=None, help="crisis window end, YYYY-MM-DD")

    p.add_argument("--collection", default=d.collection,
                   help="swap in an RTC-processed collection here if you have one")
    p.add_argument("--polarisation", choices=["VV", "VH"], default=d.polarisation)
    p.add_argument("--pass-direction",
                   choices=["AUTO", "ASCENDING", "DESCENDING", "BOTH"],
                   default=d.pass_direction,
                   help="AUTO picks whichever single track (ascending or "
                        "descending) best covers the AOI. ASCENDING/DESCENDING "
                        "force one track only. BOTH runs an independent, "
                        "geometrically-consistent pipeline on each pass and "
                        "unions the two flood masks -- this recovers flood "
                        "pixels hidden by layover/shadow in one geometry but "
                        "visible in the other, at the cost of two full runs. "
                        "--orbit-number is incompatible with BOTH.")
    p.add_argument("--orbit-number", type=int, default=None,
                   help="force a specific relative orbit (AUTO/ASCENDING/"
                        "DESCENDING only, not BOTH)")

    p.add_argument("--scale", type=int, default=d.scale)
    p.add_argument("--hist-scale", type=int, default=d.hist_scale)
    p.add_argument("--vector-scale", type=int, default=d.vector_scale)
    p.add_argument("--min-bucket-width", type=float, default=d.min_bucket_width)
    p.add_argument("--min-bimodality", type=float, default=d.min_bimodality,
                   help="floor-corrected bimodality index below which the "
                        "threshold is flagged as untrustworthy")
    p.add_argument("--min-ashman-d", type=float, default=d.min_ashman_d)
    p.add_argument("--no-cross-check", action="store_true")
    p.add_argument("--reject-implausible", action="store_true")

    p.add_argument("--change-detection", action="store_true")
    p.add_argument("--baseline-days-before", type=int, default=d.baseline_days_before)
    p.add_argument("--no-absolute-water-check", action="store_true")

    p.add_argument("--hand-threshold-m", type=float, default=d.hand_threshold_m)
    p.add_argument("--include-tree-cover", action="store_true",
                   help="do not mask ESA WorldCover tree cover (not recommended)")
    p.add_argument("--merge-urban", action="store_true",
                   help="merge built-up detections into the main layer instead of "
                        "keeping them separate and flagged")

    p.add_argument("--outdir", default=d.outdir)
    p.add_argument("--no-map", action="store_true")
    p.add_argument("--no-shapefile", action="store_true")
    p.add_argument("--no-kml", action="store_true")
    p.add_argument("--export-to-drive", action="store_true")
    p.add_argument("--drive-folder", default=d.drive_folder)
    p.add_argument("-v", "--verbose", action="store_true")

    a = p.parse_args(argv)

    if a.pass_direction == "BOTH" and a.orbit_number is not None:
        p.error(
            "--orbit-number forces one specific track and is incompatible "
            "with --pass-direction BOTH, which needs to select its own best "
            "track on each of the two passes independently."
        )

    cfg = Config(
        project_id=a.project_id,
        event_name=a.event_name,
        center_lat=a.lat,
        center_lon=a.lon,
        radius_km=a.radius_km,
        start_date=a.start,
        end_date=a.end,
        collection=a.collection,
        polarisation=a.polarisation,
        pass_direction=a.pass_direction,
        orbit_number=a.orbit_number,
        scale=a.scale,
        hist_scale=a.hist_scale,
        vector_scale=a.vector_scale,
        min_bucket_width=a.min_bucket_width,
        min_bimodality=a.min_bimodality,
        min_ashman_d=a.min_ashman_d,
        run_cross_check=not a.no_cross_check,
        reject_implausible=a.reject_implausible,
        change_detection=a.change_detection,
        baseline_days_before=a.baseline_days_before,
        require_absolute_water=not a.no_absolute_water_check,
        hand_threshold_m=a.hand_threshold_m,
        exclude_tree_cover=not a.include_tree_cover,
        urban_as_separate_layer=not a.merge_urban,
        outdir=a.outdir,
        make_map=not a.no_map,
        write_shapefile=not a.no_shapefile,
        write_kml=not a.no_kml,
        export_to_drive=a.export_to_drive,
        drive_folder=a.drive_folder,
    )
    logging.basicConfig(
        level=logging.DEBUG if a.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
    )

    still_missing = [f for f in REQUIRED_IDENTITY_FIELDS if getattr(cfg, f) in (None, "")]
    if a.interactive:
        # Full interactive mode: re-ask every identity/AOI field regardless of
        # what was already passed on the command line.
        cfg = interactive_config(cfg, only_missing=False)
    elif still_missing and sys.stdin.isatty():
        # Some required fields weren't given as flags. Rather than silently
        # falling back to a baked-in example region, prompt for exactly the
        # gaps -- this is what makes plain `python3 nrt_flood_engine.py`
        # (no flags at all) behave like a guided run instead of quietly
        # analysing Kuttanad in August 2026 every time.
        LOG.info(
            "Missing required input(s) (%s); prompting for them.",
            ", ".join(still_missing),
        )
        cfg = interactive_config(cfg, only_missing=True)
    # If input isn't a terminal (e.g. piped/scheduled) and fields are still
    # missing, we deliberately do NOT prompt or default -- run() will raise a
    # clear RuntimeError via require_identity() instead of hanging on input().
    return cfg


def main(argv: Optional[Sequence[str]] = None) -> int:
    cfg = parse_args(argv)
    try:
        run(cfg)
    except RuntimeError as exc:
        LOG.error("%s", exc)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())