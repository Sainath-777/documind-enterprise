import asyncio
from google import genai
from app.core.config import settings

# FIXED v4 import
from langfuse import observe, get_client

client = genai.Client(api_key=settings.GEMINI_API_KEY)
GENERATION_MODEL = "gemini-flash-latest"

@observe(as_type="generation")
async def generate_answer(prompt: str, model: str = GENERATION_MODEL) -> tuple[str, int]:
    """Returns (answer_text, tokens_used)."""
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
    
    # FIXED: v4 syntax for updating current generation tokens
    get_client().update_current_generation(
        model=model,
        usage_details={"total": tokens},
        metadata={"cost_usd": round(tokens * 0.0000005, 6)}
    )
    return answer, tokens
