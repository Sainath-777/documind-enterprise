# DocuMind — Complete Project Overview

## 1. What is DocuMind?

### The Simple Explanation
You're building a **smart document assistant**. You upload a PDF, and then you can ask questions about it in plain English. The system reads the PDF, breaks it into pieces, and finds the most relevant pieces to answer your question.

Think of it like this: Google searches the whole internet. DocuMind searches only **your private documents**, and gives a proper answer based on their content — not just a list of links.

### The Technical Explanation
DocuMind is a **multi-tenant RAG (Retrieval-Augmented Generation) SaaS API** built with FastAPI, PostgreSQL, Pinecone, Redis, and Celery.

**How it works:**
1. **User uploads PDF**
   → FastAPI receives it
   → Celery worker processes it in the background:
     → PyMuPDF extracts text
     → Chunker splits text into 500-token pieces
     → Gemini API converts each chunk to a 3072-dimensional vector (embedding)
     → Pinecone stores the vectors | PostgreSQL stores the text + metadata
2. **User asks a question**
   → FastAPI receives the query
   → Gemini embeds the question (into the same vector space)
   → [PARALLEL] Pinecone: finds semantically similar chunks (vectors)
   → [PARALLEL] PostgreSQL: finds keyword-matching chunks (BM25/TSVECTOR)
   → RRF (Reciprocal Rank Fusion) merges both result lists into one ranked list
   → Cohere reranker picks the top 5 most relevant chunks
   → Redis cache stores these chunks for future identical queries
   → Gemini LLM reads the chunks + question → generates the final answer
   → Answer is streamed back token-by-token via SSE

---

## 2. Project Structure & File Map

```
DocuMind/
├── SKILL.md                          ← Rules for how AI should write code in this project
├── DOCUMIND_PHASES_SKILL.md          ← The full roadmap: what to build in which order
├── HANDOFF.md                        ← Reference designs and architecture notes
├── PROGRESS.md                       ← What's been built so far
│
└── documind/                         ← The actual Python application
    ├── .env                          ← All secret keys and config (NEVER commit this)
    ├── requirements.txt              ← List of all packages the project needs
    │
    └── app/                          ← All application code lives here
```

### `app/` — Top Level
* `main.py`: The **front door** of the app. Starts FastAPI, connects to DB, registers all routes.

### `app/core/` — The Engine Room
* `config.py`: **Reads your `.env` file** and makes settings available everywhere.
* `security.py`: **Password & API key tools** — hashes passwords, verifies keys.
* `logging.py`: **Sets up structured logging** — all logs appear as JSON.

### `app/models/` — The Database Tables (SQLAlchemy)
* `database.py`: **Opens the database connection**.
* `tenant.py`: The **company/user** table. Isolates data using `pinecone_namespace`.
* `document.py`: The **documents** table (status: PENDING/PROCESSING) AND the **chunks** table.
* `query.py`: The **query log** table — records every question, latency, and cost.
* `api_key.py`: The **API keys** table — stores hashed keys.

### `app/schemas/` — Request/Response Shapes (Pydantic)
* `auth.py`: Defines register/login request shapes.
* `document.py`: Defines upload response shapes.
* `query.py`: Defines query request/response shapes.

### `app/api/v1/` — The API Endpoints (What Users Call)
* `router.py`: The **switchboard** connecting endpoints to URLs.
* `dependencies.py`: The **security guard** (`verify_api_key`).

#### `app/api/v1/endpoints/`
* `auth.py`: `/auth/register` (creates user/tenant/key) & `/auth/login` (JWT token).
* `documents.py`: `/documents/upload` (accepts PDF, fires Celery) & `/documents` (lists docs).
* `status.py`: `/status/{job_id}` (checks ingestion progress).
* `query.py`: `/query` (main Q&A endpoint, returns JSON).
* `query_stream.py`: `/query/stream` (streams answer via SSE).

### `app/services/` — The Brain (Business Logic)

#### `ingestion/` (The PDF Pipeline)
* `pdf_processor.py`: Extracts text from PDFs using PyMuPDF.
* `chunker.py`: Splits text into overlapping 500-token pieces.
* `embedder.py`: Sends chunks to Gemini, gets vectors.
* `uploader.py`: Sends vectors to Pinecone in batches.

#### `retrieval/` (Finding the Right Chunks)
* `semantic_search.py`: Asks Pinecone for similar vectors.
* `bm25_search.py`: Asks PostgreSQL for exact keyword matches.
* `hybrid_fusion.py`: Merges vector and keyword lists using RRF.
* `reranker.py`: Sends top 20 chunks to Cohere to pick the absolute best 5.

#### `generation/` (Writing the Answer)
* `prompt_builder.py`: Assembles chunks + question into a prompt.
* `llm_client.py`: Calls Gemini for the full answer.
* `llm_client_stream.py`: Calls Gemini and yields tokens one by one (streaming).

#### `cache/` (Remembering Answers)
* `semantic_cache.py`: Checks Redis before querying. Skips retrieval on cache hit.

#### `auth_service.py`
* Handles user creation, password hashing, and API key generation.

### `app/workers/` — Background Jobs
* `celery_app.py`: Creates Celery instance, connects to Redis.
* `tasks.py`: The `ingest_document` task that runs the full ingestion pipeline.

---

## 3. Major Issues Faced & Solutions

### Issue 1 — Celery Crashed on Windows Immediately
* **Problem**: Running `celery worker` on Windows threw `ValueError: set_wakeup_fd` or silently crashed.
* **Root Cause**: Celery uses Unix-style process forking. Windows uses `spawn`, which is incompatible with Celery's default setup.
* **Fix**: Added the `-P solo` flag to force Celery to run as a single synchronous thread.

### Issue 2 — Temp File Deleted Before Retry (`FileNotFoundError`)
* **Problem**: When Gemini rate-limited us, Celery retried the task, but failed because the temp PDF was already deleted.
* **Root Cause**: The `finally` block deleted the file unconditionally, even during retries.
* **Fix**: Added a check to only delete the file on the **last** retry.

### Issue 3 — Pinecone Dimension Mismatch (400 Error)
* **Problem**: Pinecone rejected vector uploads.
* **Root Cause**: Switched from OpenAI (1536 dims) to Gemini (3072 dims), but the Pinecone index was still set to 1536.
* **Fix**: Recreated the Pinecone index with `dimension=3072`.

### Issue 4 — Gemini `429 RESOURCE_EXHAUSTED`
* **Problem**: API calls failed with quota exceeded immediately.
* **Root Cause**: The `gemini-2.0-flash` model had a free tier limit of 0 requests/day in the user's region.
* **Fix**: Switched to `gemini-flash-latest`.

### Issue 5 — `chunks=0` After Ingestion
* **Problem**: Celery completed successfully but indexed 0 chunks.
* **Root Cause**: The uploaded PDF was a scanned/image-based document. PyMuPDF requires a text layer.
* **Fix**: Tested with a text-based PDF (Wikipedia saved as PDF).

### Issue 6 — Cache Key Bug (`"Python, what is it?"` ≠ `"What is Python?"`)
* **Problem**: Cache normalization didn't collapse different phrasings to the same key.
* **Root Cause**: Stopword list was too small, missing words like `"it"`.
* **Fix**: Expanded the stopword list to over 60 common words.

---

## 4. Technical Terminology Dictionary

| Term | Meaning |
|---|---|
| **RAG** | **Retrieval-Augmented Generation**: Finding relevant info in your docs and giving it to the AI so it answers based on your data, not its general training. |
| **Embedding / Vector** | A list of numbers (e.g., 3072 dims) representing the "meaning" of a text snippet. Similar meanings end up close together in vector space. |
| **Pinecone** | A specialized vector database optimized for finding similar vectors fast. |
| **BM25** | A keyword search algorithm (implemented via Postgres `TSVECTOR`). Finds docs containing exact words. Better than simple TF-IDF. |
| **Hybrid Search** | Using both semantic (vector) search and lexical (BM25 keyword) search simultaneously. |
| **RRF** | **Reciprocal Rank Fusion**: A mathematical way to combine two ranked lists into one fair list, even if their scoring systems are completely different. |
| **Reranker / Cross-Encoder** | A second AI model that reads the query AND the candidate documents together to assign a highly accurate relevance score. Better precision than vectors alone. |
| **Celery** | A distributed task queue. It runs slow tasks (like processing PDFs) in the background so the API doesn't freeze. |
| **SSE** | **Server-Sent Events**: A simple HTTP protocol where the server streams data (like LLM tokens) to the client in real-time. |
| **asyncio.Queue bridge** | A technique to safely pass data between a synchronous background thread (the Gemini SDK) and the asynchronous FastAPI event loop. |
| **TSVECTOR / GIN Index** | PostgreSQL features for fast full-text keyword search. |
| **Multi-tenant** | A system architecture where many different users/companies use the same app, but their data is strictly isolated (e.g., using a `tenant_id`). |
| **Semantic Cache** | Storing the retrieved chunks for a specific query hash in Redis. If the exact same question is asked again, the expensive embedding and retrieval steps are skipped. |
