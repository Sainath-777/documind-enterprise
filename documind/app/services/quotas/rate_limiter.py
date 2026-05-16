from fastapi import HTTPException
from app.services.cache.semantic_cache import _redis_client
from app.core.logging import logger

def check_rate_limit(tenant_id: str, endpoint: str, limit: int = 100, window_seconds: int = 60) -> None:
    """
    Implements a sliding window rate limiter using Redis.
    Raises HTTPException(429) if tenant exceeded limit in the current window.
    Fails open on Redis error so a cache outage doesn't block users.
    """
    key = f"ratelimit:{tenant_id}:{endpoint}"
    
    try:
        pipe = _redis_client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        result = pipe.execute()
        
        current_count, ttl = result[0], result[1]
        
        if ttl == -1:
            # Key has no expiry (just created), set TTL
            _redis_client.expire(key, window_seconds)
            
        if current_count > limit:
            logger.warning("rate_limit_exceeded", tenant_id=tenant_id, endpoint=endpoint, limit=limit)
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded", 
                headers={"Retry-After": str(window_seconds)}
            )
            
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("rate_limiter_failed", error=str(exc))
        # Fail-open: allow request to proceed if Redis is unreachable
