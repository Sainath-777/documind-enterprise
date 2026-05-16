"""
Reciprocal Rank Fusion (RRF) hybrid retrieval fusion.

WHY RRF over score averaging:
  - Pinecone returns cosine similarity scores (0.0 – 1.0)
  - PostgreSQL ts_rank returns arbitrary TF-IDF floats (no fixed scale)
  - Averaging these is mathematically invalid — scales are incompatible
  - RRF bypasses this by using only RANK POSITION, making it scale-independent
  - Proven on the BEIR benchmark; standard k=60 constant from the original paper

Weighting (per SKILL.md 2.1): 0.7 * semantic + 0.3 * bm25
"""

from langfuse import observe


RRF_K = 60
SEMANTIC_WEIGHT = 0.7
BM25_WEIGHT = 0.3


@observe(as_type="span")
def reciprocal_rank_fusion(
    semantic_results: list[dict],
    bm25_results: list[dict],
    top_k: int = 5,
) -> list[dict]:
    """
    Fuse semantic and BM25 results using Reciprocal Rank Fusion.

    Args:
        semantic_results: Ordered list from Pinecone semantic search.
        bm25_results: Ordered list from PostgreSQL BM25 search.
        top_k: Number of final results to return.

    Returns:
        Fused, re-ranked list of chunks ready for the LLM prompt.
        Each chunk includes the full `text` field, not just text_preview.
    """
    scores: dict[str, dict] = {}

    # Score semantic results
    for rank, chunk in enumerate(semantic_results):
        chunk_id = chunk["id"]
        rrf_score = SEMANTIC_WEIGHT * (1.0 / (RRF_K + rank + 1))
        if chunk_id not in scores:
            scores[chunk_id] = {"chunk": chunk, "rrf_score": 0.0}
        scores[chunk_id]["rrf_score"] += rrf_score

    # Score BM25 results
    for rank, chunk in enumerate(bm25_results):
        chunk_id = chunk["id"]
        rrf_score = BM25_WEIGHT * (1.0 / (RRF_K + rank + 1))
        if chunk_id not in scores:
            scores[chunk_id] = {"chunk": chunk, "rrf_score": 0.0}
        scores[chunk_id]["rrf_score"] += rrf_score

    # Sort by fused RRF score descending
    ranked = sorted(scores.values(), key=lambda x: x["rrf_score"], reverse=True)

    # Build final list — ensure text field is always present for prompt builder
    fused: list[dict] = []
    for item in ranked[:top_k]:
        chunk = item["chunk"]
        fused.append({
            "id": chunk["id"],
            "score": round(item["rrf_score"], 6),
            "doc_id": chunk.get("doc_id", chunk.get("document_id", "")),
            "page": chunk.get("page", 0),
            "text": chunk.get("text", chunk.get("text_preview", "")),
            "text_preview": chunk.get("text_preview", chunk.get("text", "")[:200]),
            "source": "hybrid",
        })

    return fused
