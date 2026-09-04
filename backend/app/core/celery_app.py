"""
Celery application factory.
"""
from celery import Celery
from .config import settings

celery_app = Celery(
    "cyberflares",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.simulation"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    task_time_limit=60 * 60 * 6,   # 6-hour hard cap
    task_soft_time_limit=60 * 60 * 5,
    worker_prefetch_multiplier=1,
)
