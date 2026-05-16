import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.database import get_db
from app.models.usage import QuotaLimit
from app.models.document import Document
from app.models.query import Query
from app.api.v1.dependencies import verify_api_key, get_current_tenant_id
from app.services.cache.semantic_cache import _redis_client

router = APIRouter()


@router.get("/me/usage")
async def get_my_usage(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """JWT-authenticated self-service usage endpoint for the dashboard."""
    return await _build_usage_response(tenant_id, db)


@router.get("/usage/{target_tenant_id}")
async def get_tenant_usage(
    target_tenant_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(verify_api_key),
):
    return await _build_usage_response(target_tenant_id, db)


async def _build_usage_response(target_tenant_id: str, db: AsyncSession):
    result = await db.execute(select(QuotaLimit).where(QuotaLimit.tenant_id == uuid.UUID(target_tenant_id)))
    quota = result.scalars().first()

    if not quota:
        raise HTTPException(status_code=404, detail="Quota limits not found for this tenant")

    count_result = await db.execute(
        select(func.count(Document.id))
        .where(Document.tenant_id == uuid.UUID(target_tenant_id))
        .where(Document.processing_status != 'failed')
    )
    db_docs = count_result.scalar_one()

    # Get real query count from DB (fallback from Redis)
    query_count_result = await db.execute(
        select(func.count(Query.id))
        .where(Query.tenant_id == uuid.UUID(target_tenant_id))
    )
    db_queries = query_count_result.scalar_one()

    token_sum_result = await db.execute(
        select(func.coalesce(func.sum(Query.tokens_used), 0))
        .where(Query.tenant_id == uuid.UUID(target_tenant_id))
    )
    db_tokens = int(token_sum_result.scalar_one())

    try:
        redis_queries = int(_redis_client.get(f"usage:{target_tenant_id}:queries") or db_queries)
        redis_tokens = int(_redis_client.get(f"usage:{target_tenant_id}:tokens") or db_tokens)
    except Exception:
        redis_queries = db_queries
        redis_tokens = db_tokens

    return {
        "tenant_id": target_tenant_id,
        "plan_limits": {
            "max_queries_per_month": quota.max_queries_per_month,
            "max_documents": quota.max_documents,
            "max_tokens_per_month": quota.max_tokens_per_month,
        },
        "current_usage": {
            "queries_this_month": redis_queries,
            "tokens_this_month": redis_tokens,
            "documents_total": db_docs,
        },
        "usage_pct": {
            "queries": round((redis_queries / max(quota.max_queries_per_month, 1)) * 100, 2),
            "tokens": round((redis_tokens / max(quota.max_tokens_per_month, 1)) * 100, 2),
            "documents": round((db_docs / max(quota.max_documents, 1)) * 100, 2),
        },
    }
