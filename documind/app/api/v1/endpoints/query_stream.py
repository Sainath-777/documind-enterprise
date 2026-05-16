import json
import uuid
import time
import asyncio
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.database import get_db
from app.models.tenant import Tenant
from app.models.query import Query
from app.schemas.query import QueryRequest
from app.api.v1.dependencies import get_current_tenant_id
from app.services.ingestion.embedder import generate_embeddings
from app.services.retrieval.semantic_search import semantic_search
from app.services.retrieval.bm25_search import bm25_search
from app.services.retrieval.hybrid_fusion import reciprocal_rank_fusion
from app.services.retrieval.reranker import rerank_chunks
from app.services.cache.semantic_cache import get_cached_chunks, set_cached_chunks
from app.services.generation.prompt_builder import build_rag_prompt
from app.services.generation.llm_client_stream import stream_answer
from app.services.generation.judge import judge_response
from app.core.logging import logger
from app.services.quotas.rate_limiter import check_rate_limit
from app.services.quotas.usage_tracker import check_query_quota, increment_query_usage

router = APIRouter()


def _sse(event: str, data: dict) -> str:
    """Format a single SSE message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/stream")
async def query_stream(
    request: QueryRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    request_id = str(uuid.uuid4())
    start = time.time()

    # Get tenant namespace
    result = await db.execute(
        select(Tenant).where(Tenant.id == uuid.UUID(tenant_id))
    )
    tenant = result.scalars().first()

    check_rate_limit(tenant_id, "query_stream")
    await check_query_quota(tenant_id, db)

    # --- Cache check ---
    cached_chunks = get_cached_chunks(tenant_id, request.query, request.top_k)
    if cached_chunks:
        final_chunks = cached_chunks
        retrieval_latency = 0
        cache_hit = True
    else:
        cache_hit = False

        # Embed query
        embeddings = await generate_embeddings([request.query])
        query_embedding = embeddings[0]

        # Parallel retrieval
        retrieval_start = time.time()
        loop = asyncio.get_event_loop()

        semantic_task = loop.run_in_executor(
            None,
            lambda: semantic_search(
                tenant.pinecone_namespace, query_embedding, top_k=20
            ),
        )
        bm25_task = bm25_search(db, tenant_id, request.query, top_k=20)
        semantic_results, bm25_results = await asyncio.gather(
            semantic_task, bm25_task
        )
        retrieval_latency = int((time.time() - retrieval_start) * 1000)

        # Fuse + Rerank
        fused_chunks = reciprocal_rank_fusion(
            semantic_results, bm25_results, top_k=20
        )
        final_chunks = await rerank_chunks(
            request.query, fused_chunks, top_k=request.top_k
        )

        # ── Enrich: fetch full text from DB for chunks that only have a 200-char preview ──
        # Pinecone only stores text_preview in metadata. BM25 chunks already have full text.
        # For semantic-only chunks, we pull the full text from Postgres by pinecone_id.
        thin_ids = [
            c["id"] for c in final_chunks
            if len(c.get("text", "")) <= 200  # short = came from Pinecone only
        ]
        if thin_ids:
            from sqlalchemy import text as sql_text
            from app.models.document import Chunk
            enrich_result = await db.execute(
                sql_text(
                    "SELECT pinecone_id, text FROM chunks WHERE pinecone_id = ANY(:ids) AND tenant_id = :tid"
                ),
                {"ids": thin_ids, "tid": uuid.UUID(tenant_id)},
            )
            full_texts = {row.pinecone_id: row.text for row in enrich_result.fetchall()}
            for chunk in final_chunks:
                if chunk["id"] in full_texts:
                    chunk["text"] = full_texts[chunk["id"]]

        set_cached_chunks(tenant_id, request.query, request.top_k, final_chunks)

    prompt = build_rag_prompt(request.query, final_chunks)

    async def event_generator():
        total_tokens = 0
        full_answer = []  # Collect tokens for the judge
        try:
            # Event 1: metadata (sent immediately, before any tokens)
            yield _sse("metadata", {
                "request_id": request_id,
                "retrieval_latency_ms": retrieval_latency,
                "cache_hit": cache_hit,
            })

            # Event 2: stream tokens
            async for token_text, is_done, tokens in stream_answer(prompt):
                if is_done:
                    total_tokens = tokens
                    break
                full_answer.append(token_text)
                yield _sse("token", {"content": token_text})

            # Event 3: sources
            yield _sse("sources", {
                "chunks": [
                    {
                        "doc_id": c["doc_id"],
                        "page": c["page"],
                        "score": c.get("rerank_score", c["score"]),
                        "text_preview": c.get(
                            "text_preview", c.get("text", "")[:200]
                        ),
                    }
                    for c in final_chunks
                ]
            })

            # Event 4: done
            total_latency = int((time.time() - start) * 1000)
            cost = round(total_tokens * 0.0000005, 6)
            yield _sse("done", {
                "tokens_used": total_tokens,
                "cost_usd": cost,
                "latency_ms": total_latency,
            })

            # ── Groq Judge (silent, runs in background after stream ends) ──
            answer_text = "".join(full_answer)
            background_tasks.add_task(
                judge_response,
                request.query,
                final_chunks,
                answer_text,
            )

            # Log to DB
            query_log = Query(
                tenant_id=uuid.UUID(tenant_id),
                query_text=request.query,
                retrieval_latency_ms=retrieval_latency,
                generation_latency_ms=total_latency - retrieval_latency,
                chunks_retrieved=len(final_chunks),
                rerank_applied=True,
                tokens_used=total_tokens,
                cost_usd=cost,
                cache_hit=cache_hit,
            )
            db.add(query_log)
            await db.commit()
            
            increment_query_usage(tenant_id, total_tokens)

        except Exception as exc:
            logger.error("stream_endpoint_error", error=str(exc))
            yield _sse("error", {"message": "Stream failed. Please retry."})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disables nginx buffering in production
        },
    )
