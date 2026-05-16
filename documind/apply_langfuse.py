import os

def patch_llm():
    llm_path = 'app/services/generation/llm_client.py'
    llm_code = '''import asyncio
from google import genai
from app.core.config import settings
from langfuse.decorators import observe, langfuse_context

client = genai.Client(api_key=settings.GEMINI_API_KEY)
GENERATION_MODEL = "gemini-flash-latest"

@observe(as_type="generation")
async def generate_answer(prompt: str, model: str = GENERATION_MODEL) -> tuple[str, int]:
    """Returns (answer_text, tokens_used). Traced as a Langfuse Generation span."""
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=model,
            contents=prompt,
        )
    )
    answer = response.text or ""
    tokens = response.usage_metadata.total_token_count if response.usage_metadata else 0

    # Send token usage and model name to Langfuse
    langfuse_context.update_current_observation(
        model=model,
        usage={
            "input": 0,
            "output": 0,
            "total": tokens,
            "unit": "TOKENS",
        },
        metadata={"cost_usd": round(tokens * 0.0000005, 6)},
    )
    return answer, tokens
'''
    with open(llm_path, 'w', encoding='utf-8') as f:
        f.write(llm_code)


def patch_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old not in content:
            print(f"WARNING: Target not found in {path}:\n{old}")
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_llm()

patch_file('app/services/retrieval/semantic_search.py', [
    ('from app.core.config import settings', 'from app.core.config import settings\nfrom langfuse.decorators import observe'),
    ('def semantic_search(', '@observe(as_type="span")\ndef semantic_search(')
])

patch_file('app/services/retrieval/bm25_search.py', [
    ('from app.core.logging import logger', 'from app.core.logging import logger\nfrom langfuse.decorators import observe'),
    ('async def bm25_search(', '@observe(as_type="span")\nasync def bm25_search(')
])

patch_file('app/services/retrieval/hybrid_fusion.py', [
    ('RRF_K = 60', 'from langfuse.decorators import observe\n\nRRF_K = 60'),
    ('def reciprocal_rank_fusion(', '@observe(as_type="span")\ndef reciprocal_rank_fusion(')
])

patch_file('app/services/retrieval/reranker.py', [
    ('from app.core.logging import logger', 'from app.core.logging import logger\nfrom langfuse.decorators import observe'),
    ('async def rerank_chunks(', '@observe(as_type="span")\nasync def rerank_chunks(')
])

patch_file('app/main.py', [
    ('    logger.info("documind_shutting_down")', '    logger.info("documind_shutting_down")\n    if settings.LANGFUSE_PUBLIC_KEY:\n        from langfuse import Langfuse\n        Langfuse().flush()')
])

patch_file('app/api/v1/endpoints/query.py', [
    ('from app.services.quotas.usage_tracker import check_query_quota, increment_query_usage', 'from app.services.quotas.usage_tracker import check_query_quota, increment_query_usage\nfrom langfuse.decorators import observe, langfuse_context'),
    ('@router.post("", response_model=QueryResponse)\nasync def query_documents(', '@router.post("", response_model=QueryResponse)\n@observe()\nasync def query_documents('),
    ('    await check_query_quota(tenant_id, db)', '    await check_query_quota(tenant_id, db)\n\n    langfuse_context.update_current_trace(\n        name="rag_query",\n        user_id=tenant_id,\n        metadata={"top_k": request.top_k, "query_length": len(request.query)},\n    )'),
    ('    increment_query_usage(tenant_id, tokens_used)', '    increment_query_usage(tenant_id, tokens_used)\n\n    langfuse_context.update_current_trace(\n        metadata={"cache_hit": cache_hit, "latency_ms": total_latency, "tokens": tokens_used}\n    )')
])

print("All patches applied!")
