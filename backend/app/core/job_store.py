"""
Thin Redis-backed key-value store for simulation job state.

State is decoupled from Celery's own result backend so we can attach rich
per-phase progress (breach → geometry → sph-input → awaiting-external-gpu →
delft3d → postprocess → done) without abusing task metadata.
"""
import json
import time
from typing import Any
import redis

from .config import settings

_r = redis.Redis.from_url(settings.redis_url, decode_responses=True)

_KEY = "cf:job:{job_id}"


def _key(job_id: str) -> str:
    return _KEY.format(job_id=job_id)


def create(job_id: str, payload: dict[str, Any]) -> None:
    payload = {
        **payload,
        "id": job_id,
        "status": "queued",
        "phase": "queued",
        "progress": 0,
        "created_at": time.time(),
        "updated_at": time.time(),
        "artifacts": {},
        "error": None,
    }
    _r.set(_key(job_id), json.dumps(payload))


def get(job_id: str) -> dict[str, Any] | None:
    raw = _r.get(_key(job_id))
    return json.loads(raw) if raw else None


def update(job_id: str, **fields: Any) -> dict[str, Any] | None:
    current = get(job_id)
    if not current:
        return None
    current.update(fields)
    current["updated_at"] = time.time()
    _r.set(_key(job_id), json.dumps(current))
    return current


def set_artifact(job_id: str, name: str, path: str) -> None:
    current = get(job_id) or {}
    artifacts = current.get("artifacts", {})
    artifacts[name] = path
    update(job_id, artifacts=artifacts)


def list_all(limit: int = 100) -> list[dict[str, Any]]:
    out = []
    for k in _r.scan_iter(match=_KEY.format(job_id="*"), count=100):
        raw = _r.get(k)
        if raw:
            out.append(json.loads(raw))
        if len(out) >= limit:
            break
    out.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return out
