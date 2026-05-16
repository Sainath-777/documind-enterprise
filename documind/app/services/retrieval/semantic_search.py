from pinecone import Pinecone
from app.core.config import settings
from langfuse import observe

pc = Pinecone(api_key=settings.PINECONE_API_KEY)
INDEX_NAME = "documind"

@observe(as_type="span")
def semantic_search(namespace: str, query_embedding: list[float], top_k: int = 5) -> list[dict]:
    index = pc.Index(INDEX_NAME)
    result = index.query(
        vector=query_embedding,
        top_k=top_k,
        namespace=namespace,
        include_metadata=True,
    )
    return [
        {
            "id": m.id,
            "score": m.score,
            "doc_id": m.metadata.get("document_id", ""),
            "page": m.metadata.get("page_number", 0),
            "text_preview": m.metadata.get("text_preview", ""),
        }
        for m in result.matches
    ]
