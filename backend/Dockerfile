# ─────────────────────────────────────────────────────────────
# CyberFlares backend image (shared by cf-api and cf-worker).
#
# We use python:3.11-slim (NOT 3.13) so we get prebuilt wheels for
# scipy / rasterio / numpy-stl / richdem — no OpenBLAS compile hell.
# GDAL is installed from system packages and rasterio picks it up
# via its published binary wheel.
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm

# Non-interactive apt & sane Python defaults
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System packages: GDAL + PROJ + build essentials for the few wheels
# that still compile (richdem does).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gdal-bin \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
        proj-data \
        proj-bin \
        libspatialindex-dev \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

# GDAL headers for the geospatial wheels
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal \
    C_INCLUDE_PATH=/usr/include/gdal \
    GDAL_CONFIG=/usr/bin/gdal-config

WORKDIR /app

# Install Python deps first (cache-friendly layer)
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Application code (mounted as a volume in dev; baked in for prod builds)
COPY app ./app
COPY scripts ./scripts

# Runtime dirs used by app.core.config
RUN mkdir -p /app/data/{dems,simulations,cache,precomputed}

EXPOSE 8000

# Default command is the API; compose overrides for the worker.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
