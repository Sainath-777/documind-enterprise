import json
from fastapi import APIRouter, Depends, HTTPException
import redis.asyncio as aioredis
from app.core.config import settings
from app.schemas.document import JobStatusResponse
from app.api.v1.dependencies import verify_api_key

router = APIRouter()


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    tenant_id: str = Depends(verify_api_key),
):
    r = await aioredis.from_url(settings.REDIS_URL)
    try:
        data = await r.get(f"job:{job_id}:progress")
        if not data:
            raise HTTPException(status_code=404, detail="Job not found or expired.")
        progress = json.loads(data)
        return {
            "job_id": job_id,
            "status": "completed" if progress["current_step"] == "completed" else "processing",
            "progress": progress["percentage"],
            "current_step": progress["current_step"],
            "total_chunks": progress["total_chunks"],
            "processed_chunks": progress["processed_chunks"],
            "errors": [],
        }
    finally:
        await r.aclose()
