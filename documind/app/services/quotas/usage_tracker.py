import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.usage import QuotaLimit
from app.models.document import Document
from app.services.cache.semantic_cache import _redis_client
from app.core.logging import logger

def increment_query_usage(tenant_id: str, tokens_used: int) -> None:
    """Atomically increments the per-tenant query and token counters in Redis."""
    try:
        pipe = _redis_client.pipeline()
        pipe.incr(f"usage:{tenant_id}:queries")
        pipe.incrby(f"usage:{tenant_id}:tokens", tokens_used)
        pipe.execute()
    except Exception as exc:
        logger.error("increment_query_usage_failed", error=str(exc))

def increment_document_usage(tenant_id: str) -> None:
    """Atomically increments the per-tenant document counter in Redis."""
    try:
        _redis_client.incr(f"usage:{tenant_id}:documents")
    except Exception as exc:
        logger.error("increment_document_usage_failed", error=str(exc))

async def check_query_quota(tenant_id: str, db: AsyncSession) -> None:
    """
    Checks if this tenant has exceeded their monthly query/token quota.
    Raises HTTPException(403) with a human-readable message if exceeded.
    Fetches QuotaLimit from DB. If no QuotaLimit row found, SKIP enforcement (fail-open).
    Reads current count from Redis counter.
    """
    result = await db.execute(select(QuotaLimit).where(QuotaLimit.tenant_id == uuid.UUID(tenant_id)))
    quota = result.scalars().first()
    
    if not quota:
        return # Fail-open if no quota limits defined
        
    try:
        current_queries = int(_redis_client.get(f"usage:{tenant_id}:queries") or 0)
        current_tokens = int(_redis_client.get(f"usage:{tenant_id}:tokens") or 0)
        
        if current_queries >= quota.max_queries_per_month:
            logger.warning("query_quota_exceeded", tenant_id=tenant_id)
            raise HTTPException(status_code=403, detail=f"Monthly query quota exceeded ({quota.max_queries_per_month})")
            
        if current_tokens >= quota.max_tokens_per_month:
            logger.warning("token_quota_exceeded", tenant_id=tenant_id)
            raise HTTPException(status_code=403, detail=f"Monthly token quota exceeded ({quota.max_tokens_per_month})")
            
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("check_query_quota_failed", error=str(exc))
        # Fail open on Redis error

async def check_document_quota(tenant_id: str, db: AsyncSession) -> None:
    """
    Checks if adding one more document would exceed max_documents.
    Also checks total file_size_bytes of existing documents vs max_storage_bytes.
    Raises HTTPException(403) if quota exceeded.
    """
    result = await db.execute(select(QuotaLimit).where(QuotaLimit.tenant_id == uuid.UUID(tenant_id)))
    quota = result.scalars().first()
    
    if not quota:
        return # Fail-open
        
    # Check DB directly since it's the source of truth for documents
    count_result = await db.execute(
        select(func.count(Document.id))
        .where(Document.tenant_id == uuid.UUID(tenant_id))
        .where(Document.processing_status != 'failed')
    )
    current_docs = count_result.scalar_one()
    
    if current_docs >= quota.max_documents:
        logger.warning("document_quota_exceeded", tenant_id=tenant_id)
        raise HTTPException(status_code=403, detail=f"Document quota exceeded ({quota.max_documents})")
        
    size_result = await db.execute(
        select(func.sum(Document.file_size_bytes))
        .where(Document.tenant_id == uuid.UUID(tenant_id))
        .where(Document.processing_status != 'failed')
    )
    current_bytes = size_result.scalar_one() or 0
    
    if current_bytes >= quota.max_storage_bytes:
        logger.warning("storage_quota_exceeded", tenant_id=tenant_id)
        raise HTTPException(status_code=403, detail=f"Storage quota exceeded ({quota.max_storage_bytes} bytes)")
