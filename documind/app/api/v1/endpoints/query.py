import time
import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.database import get_db
from app.models.tenant import Tenant
from app.models.query import Query
from app.schemas.query import QueryRequest, QueryResponse, ChunkResponse
from app.api.v1.dependencies import get_current_tenant_id
from app.services.ingestion.embedder import generate_embeddings
from app.services.retrieval.semantic_search import semantic_search
from app.services.retrieval.bm25_search import bm25_search
from app.services.retrieval.hybrid_fusion import reciprocal_rank_fusion
from app.services.retrieval.reranker import rerank_chunks
from app.services.cache.semantic_cache import get_cached_chunks, set_cached_chunks
from app.services.generation.prompt_builder import build_rag_prompt
from app.services.generation.llm_client import generate_answer
from app.core.logging import logger
from app.services.quotas.rate_limiter import check_rate_limit
from app.services.quotas.usage_tracker import check_query_quota, increment_query_usage

# FIXED v4 import
from langfuse import observe, propagate_attributes

router = APIRouter()

@router.post("", response_model=QueryResponse)
@observe(name="rag_query")
async def query_documents(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    start = time.time()

    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalars().first()

    check_rate_limit(tenant_id, "query")
    await check_query_quota(tenant_id, db)
    
    # FIXED: v4 uses a context block to propagate attributes like user_id to all child spans
    with propagate_attributes(user_id=tenant_id):
        
        cached_chunks = get_cached_chunks(tenant_id, request.query, request.top_k)
        if cached_chunks:
            retrieval_latency = int((time.time() - start) * 1000)
            prompt = build_rag_prompt(request.query, cached_chunks)
            answer, tokens_used = await generate_answer(prompt)
            total_latency = int((time.time() - start) * 1000)
            
            query_log = Query(
                tenant_id=uuid.UUID(tenant_id), query_text=request.query,
                retrieval_latency_ms=retrieval_latency, generation_latency_ms=total_latency - retrieval_latency,
                chunks_retrieved=len(cached_chunks), rerank_applied=False,
                tokens_used=tokens_used, cost_usd=round(tokens_used * 0.0000005, 6), cache_hit=True,
            )
            db.add(query_log)
            await db.commit()
            increment_query_usage(tenant_id, tokens_used)

            return {
                "answer": answer,
                "chunks": [ChunkResponse(**c) for c in cached_chunks],
                "metadata": {
                    "retrieval_latency_ms": retrieval_latency, "generation_latency_ms": total_latency - retrieval_latency,
                    "total_latency_ms": total_latency, "cache_hit": True
                }
            }

        # Cache MISS
        query_embedding = (await generate_embeddings([request.query]))[0]

        semantic_task = asyncio.to_thread(semantic_search, tenant.pinecone_namespace, query_embedding, request.top_k * 2)
        bm25_task = bm25_search(db, tenant_id, request.query, request.top_k * 2)

        semantic_res, bm25_res = await asyncio.gather(semantic_task, bm25_task)
        fused_chunks = reciprocal_rank_fusion(semantic_res, bm25_res, top_k=request.top_k * 2)
        final_chunks = await rerank_chunks(request.query, fused_chunks, top_k=request.top_k)

        set_cached_chunks(tenant_id, request.query, request.top_k, final_chunks)
        retrieval_latency = int((time.time() - start) * 1000)

        prompt = build_rag_prompt(request.query, final_chunks)
        answer, tokens_used = await generate_answer(prompt)
        total_latency = int((time.time() - start) * 1000)

        cache_hit = False
        query_log = Query(
            tenant_id=uuid.UUID(tenant_id), query_text=request.query,
            retrieval_latency_ms=retrieval_latency, generation_latency_ms=total_latency - retrieval_latency,
            chunks_retrieved=len(final_chunks), rerank_applied=True,
            tokens_used=tokens_used, cost_usd=round(tokens_used * 0.0000005, 6), cache_hit=cache_hit,
        )
        db.add(query_log)
        await db.commit()
        increment_query_usage(tenant_id, tokens_used)

        return {
            "answer": answer,
            "chunks": [ChunkResponse(**c) for c in final_chunks],
            "metadata": {
                "retrieval_latency_ms": retrieval_latency, "generation_latency_ms": total_latency - retrieval_latency,
                "total_latency_ms": total_latency, "cache_hit": cache_hit
            }
        }
