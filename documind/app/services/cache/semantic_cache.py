"""
Phase 2.3 — Redis Semantic Cache

Cache key: sha256(tenant_id + normalized_query + top_k)
- Normalisation: lowercase → strip punctuation → remove stopwords → sort words
- This ensures "What is Python?" and "what is python" hit the same cache entry.

Cache stores: the retrieved + reranked CHUNKS (not the LLM answer).
WHY: LLM has temperature > 0, so caching the answer would make responses feel stale.
     Caching chunks gives deterministic retrieval with a fresh LLM generation each time.

TTL: 3600 seconds (1 hour)
"""

import json
import hashlib
import re
import redis
from app.core.config import settings
from app.core.logging import logger

# Reuse a single Redis connection pool
_redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

CACHE_TTL = 3600  # 1 hour


def _normalize_query(query: str) -> str:
    """Lowercase, strip punctuation, remove stopwords, sort words — order-independent."""
    STOPWORDS = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "what", "which", "who", "whom", "how", "when", "where", "why",
        "do", "does", "did", "can", "could", "would", "should", "will", "shall",
        "this", "that", "these", "those", "it", "its", "itself",
        "in", "on", "at", "to", "for", "of", "and", "or", "but", "not",
        "with", "about", "from", "by", "up", "if", "then", "so", "as",
        "i", "me", "my", "we", "our", "you", "your", "he", "she", "they", "their",
        "have", "has", "had", "get", "got", "give", "tell", "know",
    }
    text = query.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)  # keep only letters, digits, spaces
    words = [w for w in text.split() if w and w not in STOPWORDS]
    return " ".join(sorted(words))


def _build_cache_key(tenant_id: str, query: str, top_k: int) -> str:
    """Build a deterministic Redis cache key."""
    normalized = _normalize_query(query)
    raw = f"{tenant_id}:{normalized}:{top_k}"
    hash_key = hashlib.sha256(raw.encode()).hexdigest()
    return f"cache:{tenant_id}:{hash_key}"


def get_cached_chunks(tenant_id: str, query: str, top_k: int) -> list[dict] | None:
    """
    Check Redis for cached chunks.
    Returns the chunk list if cache hit, or None on miss.
    """
    try:
        key = _build_cache_key(tenant_id, query, top_k)
        cached = _redis_client.get(key)
        if cached:
            logger.info("cache_hit", key=key, tenant_id=tenant_id)
            return json.loads(cached)
        logger.info("cache_miss", key=key, tenant_id=tenant_id)
        return None
    except Exception as exc:
        logger.error("cache_get_failed", error=str(exc))
        return None


def set_cached_chunks(tenant_id: str, query: str, top_k: int, chunks: list[dict]) -> None:
    """
    Store reranked chunks in Redis with TTL.
    Silently fails so a cache write error never breaks a user query.
    """
    try:
        key = _build_cache_key(tenant_id, query, top_k)
        _redis_client.setex(key, CACHE_TTL, json.dumps(chunks))
        logger.info("cache_set", key=key, chunks=len(chunks))
    except Exception as exc:
        logger.error("cache_set_failed", error=str(exc))


def invalidate_tenant_cache(tenant_id: str) -> int:
    """
    Delete ALL cache entries for a tenant.
    Called when a tenant uploads or deletes a document (stale cache risk).
    Returns the number of keys deleted.
    """
    try:
        pattern = f"cache:{tenant_id}:*"
        keys = list(_redis_client.scan_iter(pattern))
        if keys:
            _redis_client.delete(*keys)
        logger.info("cache_invalidated", tenant_id=tenant_id, keys_deleted=len(keys))
        return len(keys)
    except Exception as exc:
        logger.error("cache_invalidate_failed", error=str(exc))
        return 0
