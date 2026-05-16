from pinecone import Pinecone
from app.core.config import settings

pc = Pinecone(api_key=settings.PINECONE_API_KEY)
INDEX_NAME = "documind"


def upsert_chunks_to_pinecone(
    namespace: str,
    chunks: list[dict],
    embeddings: list[list[float]],
    document_id: str,
) -> None:
    """Batch upsert chunks with embeddings into Pinecone namespace."""
    index = pc.Index(INDEX_NAME)
    vectors = []
    for chunk, embedding in zip(chunks, embeddings):
        vectors.append({
            "id": f"{document_id}_chunk_{chunk['chunk_index']}",
            "values": embedding,
            "metadata": {
                "document_id": document_id,
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk.get("page_number", 0),
                "text_preview": chunk["text"][:200],
            },
        })
    # Upsert in batches of 1000
    for i in range(0, len(vectors), 1000):
        index.upsert(vectors=vectors[i:i + 1000], namespace=namespace)


def delete_document_from_pinecone(namespace: str, document_id: str) -> None:
    """Delete all chunks for a specific document from Pinecone."""
    index = pc.Index(INDEX_NAME)
    # Delete by metadata filter
    index.delete(filter={"document_id": document_id}, namespace=namespace)
