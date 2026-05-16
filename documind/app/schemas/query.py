from pydantic import BaseModel
from typing import List, Optional

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5

class ChunkResponse(BaseModel):
    id: str
    doc_id: str
    page: int
    score: float
    text_preview: str
    source: Optional[str] = "hybrid"

class QueryMetadata(BaseModel):
    retrieval_latency_ms: int
    generation_latency_ms: int
    total_latency_ms: int
    cache_hit: bool

class QueryResponse(BaseModel):
    answer: str
    chunks: List[ChunkResponse]
    metadata: QueryMetadata
