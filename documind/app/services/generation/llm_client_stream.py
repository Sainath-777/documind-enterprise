"""
Phase 2.4 — Gemini streaming generator for SSE.

WHY asyncio.Queue bridge pattern:
  The Gemini SDK's generate_content_stream() is a SYNCHRONOUS iterator.
  Each next() call blocks while waiting for the next token from the network.
  If called directly inside an async function, it freezes the entire uvicorn
  event loop, blocking ALL concurrent requests.
  Fix: run the sync iteration in a ThreadPoolExecutor, push each token into
  an asyncio.Queue, and drain the queue from the async generator safely.
"""

import asyncio
from google import genai
from app.core.config import settings
from app.core.logging import logger

client = genai.Client(api_key=settings.GEMINI_API_KEY)
GENERATION_MODEL = "gemini-flash-latest"
STREAM_TIMEOUT_SECONDS = 30

_SENTINEL = object()  # signals stream is finished


async def stream_answer(prompt: str, model: str = GENERATION_MODEL):
    """
    Async generator. Yields (token_text, is_done, total_tokens).
      is_done=False → normal token chunk, token_text has content
      is_done=True  → final sentinel; token_text="" and total_tokens is set
    """
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _stream_in_thread():
        """Runs in ThreadPoolExecutor — iterates the sync Gemini stream."""
        try:
            response_stream = client.models.generate_content_stream(
                model=model,
                contents=prompt,
            )
            for chunk in response_stream:
                text = chunk.text if chunk.text else ""
                tokens = (
                    chunk.usage_metadata.total_token_count
                    if chunk.usage_metadata else 0
                )
                loop.call_soon_threadsafe(queue.put_nowait, (text, tokens))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _SENTINEL)

    loop.run_in_executor(None, _stream_in_thread)

    total_tokens = 0
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=STREAM_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                logger.error("stream_timeout", model=model)
                yield "", True, total_tokens
                return

            if item is _SENTINEL:
                yield "", True, total_tokens
                return

            if isinstance(item, Exception):
                logger.error("stream_error", error=str(item))
                raise item

            text, tokens = item
            if tokens:
                total_tokens = tokens
            if text:
                yield text, False, 0

    except GeneratorExit:
        logger.info("stream_client_disconnected")
