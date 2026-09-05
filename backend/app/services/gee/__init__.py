"""
Google Earth Engine — Sentinel-1 SAR flood mapping.

The heavy engine lives in ``flood_engine.py`` (Markert et al. 2020 Edge Otsu
+ tiled cross-check + change detection). ``wrapper.py`` gives it a clean
in-process entry point for the Celery worker.
"""
from .wrapper import run_flood_analysis, FloodAnalysisResult  # noqa: F401
