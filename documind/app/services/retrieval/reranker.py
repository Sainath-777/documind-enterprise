import asyncio
import cohere
from app.core.config import settings
from app.core.logging import logger
from langfuse import observe


co = cohere.Client(api_key=settings.COHERE_API_KEY)

@observe(as_type="span")
async def rerank_chunks(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    """
    Reranks the retrieved chunks using Cohere's Rerank API.
    Provides a second-stage retrieval to ensure the most relevant context is selected.
    Includes a graceful fallback if the API is unavailable or quota is exceeded.
    """
    if not settings.COHERE_API_KEY or not chunks:
        logger.warning("rerank_skipped", reason="missing_key_or_no_chunks")
        return chunks[:top_k]

    try:
        # Prepare texts for Cohere
        texts = [c.get("text", c.get("text_preview", "")) for c in chunks]

        # Use loop.run_in_executor because the cohere SDK is sync
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: co.rerank(
                model="rerank-english-v3.0",
                query=query,
                documents=texts,
                top_n=top_k,
            )
        )

        reranked_chunks = []
        for result in response.results:
            original_chunk = chunks[result.index]
            original_chunk["rerank_score"] = result.relevance_score
            reranked_chunks.append(original_chunk)

        logger.info("rerank_complete", original_count=len(chunks), final_count=len(reranked_chunks))
        return reranked_chunks

    except Exception as exc:
        logger.error("rerank_failed", error=str(exc))
        # Fallback to the original top_k chunks from the previous retrieval step
        return chunks[:top_k]
