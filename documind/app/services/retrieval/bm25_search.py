import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from langfuse import observe


@observe(as_type="span")
async def bm25_search(
    db: AsyncSession,
    tenant_id: str,
    query: str,
    top_k: int = 20,
) -> list[dict]:
    """
    Full-text BM25 search over the chunks table using PostgreSQL ts_rank.
    Filters by tenant_id FIRST for multi-tenant isolation and index efficiency.
    Uses websearch_to_tsquery to safely handle multi-word queries without syntax errors.
    Returns same dict format as semantic_search for uniform fusion downstream.
    """
    if not query or not query.strip():
        return []

    try:
        sql = text("""
            SELECT
                id::text,
                document_id::text,
                page_number,
                text,
                ts_rank(text_vector, websearch_to_tsquery('english', :query)) AS rank
            FROM chunks
            WHERE
                tenant_id = :tenant_id
                AND text_vector @@ websearch_to_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :top_k
        """)

        result = await db.execute(sql, {
            "query": query,
            "tenant_id": uuid.UUID(tenant_id),
            "top_k": top_k,
        })

        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "score": float(row.rank),
                "doc_id": row.document_id,
                "page": row.page_number or 0,
                "text": row.text,
                "text_preview": row.text[:200],
                "source": "bm25",
            }
            for row in rows
        ]

    except Exception as exc:
        # BM25 failure must NOT break the whole query — semantic search can still proceed
        logger.error("bm25_search_failed", error=str(exc), query=query, tenant_id=tenant_id)
        return []
