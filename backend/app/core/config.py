"""
Global settings, driven by .env / environment variables.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Paths (inside the container: /app/data)
    project_root: Path = Path(__file__).resolve().parents[3]
    data_dir: Path = project_root / "data"
    sim_dir: Path = data_dir / "simulations"
    dem_dir: Path = data_dir / "dems"
    cache_dir: Path = data_dir / "cache"
    precomputed_dir: Path = data_dir / "precomputed"

    # Redis / Celery
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # PostGIS
    postgres_dsn: str = "postgresql://cyberflares:cyberflares@postgis:5432/cyberflares"

    # MinIO / S3
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "cfadmin"
    minio_secret_key: str = "cfadmincfadmin"
    minio_secure: bool = False
    minio_bucket: str = "cyberflares"

    # SPH execution mode: "external" or "local"
    sph_mode: str = "external"
    dualsphysics_bin_dir: str = ""

    # Delft3D
    dflowfm_bin: str = ""

    # Google Earth Engine
    gee_service_account: str = ""
    gee_key_json: str = ""

    # CORS
    cf_origins: str = "http://localhost,http://localhost:5173,http://127.0.0.1"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cf_origins.split(",") if o.strip()]


settings = Settings()

for _d in (settings.data_dir, settings.sim_dir, settings.dem_dir,
           settings.cache_dir, settings.precomputed_dir):
    _d.mkdir(parents=True, exist_ok=True)
