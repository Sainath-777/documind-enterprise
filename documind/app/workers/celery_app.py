from dotenv import load_dotenv
load_dotenv()
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "documind",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=270,
    task_time_limit=300,
    task_max_retries=3,
    task_default_retry_delay=5,
    beat_schedule={
        "sync-redis-usage-to-db": {
            "task": "sync_redis_usage",
            "schedule": 3600.0,
        },
    },
    timezone="UTC",
)
