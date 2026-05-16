"""
LLM-as-a-Judge using Groq.

After Gemini generates a streaming answer, this judge silently evaluates
the response quality in the background. It uses Groq's blazing-fast
inference to score the answer on:
  - Factual grounding (is it based on the provided context?)
  - Completeness (did it answer the question fully?)
  - Formatting (did it use proper structure?)

The score is logged to the database for future analytics.
No user-facing latency added — runs purely in the background.
"""

import json
from groq import Groq
from app.core.config import settings
from app.core.logging import logger

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


JUDGE_PROMPT = """You are an AI Quality Judge evaluating a RAG (Retrieval-Augmented Generation) chatbot response.

Your task: Score the ANSWER based on the QUESTION and the CONTEXT that was retrieved.

QUESTION: {query}

RETRIEVED CONTEXT:
{context}

AI ANSWER TO EVALUATE:
{answer}

Evaluate on these 3 criteria (score each 0-10):
1. Grounding: Is the answer factually supported by the context? (10 = fully grounded, 0 = hallucinated)
2. Completeness: Did the answer fully address the question? (10 = comprehensive, 0 = completely missed the point)
3. Formatting: Is the answer well-structured and readable? (10 = excellent structure, 0 = wall of text)

Respond with ONLY a valid JSON object, nothing else:
{{"grounding": <int>, "completeness": <int>, "formatting": <int>, "overall": <int>, "reason": "<one sentence>"}}"""


def judge_response(query: str, context_chunks: list[dict], answer: str) -> dict:
    """
    Evaluate the quality of a RAG answer using Groq (llama-3.1-8b-instant).
    Returns a dict with scores, or a fallback dict if the call fails.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("judge_skipped", reason="GROQ_API_KEY not set")
        return {"grounding": -1, "completeness": -1, "formatting": -1, "overall": -1, "reason": "No Groq key"}

    # Build condensed context for the judge (don't need full chunks, just previews)
    context_text = "\n".join([
        f"[Page {c.get('page', '?')}]: {c.get('text_preview', c.get('text', ''))[:300]}"
        for c in context_chunks[:5]  # top 5 chunks is enough for the judge
    ])

    prompt = JUDGE_PROMPT.format(
        query=query,
        context=context_text,
        answer=answer[:2000],  # truncate to keep tokens low
    )

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",   # Fast, free-tier friendly
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=200,
        )
        raw = response.choices[0].message.content.strip()
        scores = json.loads(raw)
        logger.info(
            "judge_scored",
            grounding=scores.get("grounding"),
            completeness=scores.get("completeness"),
            overall=scores.get("overall"),
            reason=scores.get("reason"),
        )
        return scores

    except Exception as exc:
        logger.error("judge_failed", error=str(exc))
        return {"grounding": -1, "completeness": -1, "formatting": -1, "overall": -1, "reason": str(exc)}
