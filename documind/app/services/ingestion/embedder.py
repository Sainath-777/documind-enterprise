import asyncio
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.logging import logger
from langfuse import observe

client = genai.Client(api_key=settings.GEMINI_API_KEY)
EMBEDDING_MODEL = "gemini-embedding-001"
BATCH_SIZE = 100

@observe(as_type="span")
async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings in batches of 100 using Gemini. Returns list of 768-dim vectors."""
    all_embeddings = []
    loop = asyncio.get_event_loop()
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        # Gemini SDK is sync — run in executor to avoid blocking the event loop
        response = await loop.run_in_executor(
            None,
            lambda b=batch: client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=b,
            )
        )
        all_embeddings.extend([e.values for e in response.embeddings])
    return all_embeddings
