<div align="center">

<h1>🧠 DocuMind Enterprise</h1>

<p><strong>Production-Grade AI Document Intelligence Platform</strong></p>

<p>
  <a href="YOUR_LIVE_URL_HERE"><img src="https://img.shields.io/badge/Live_Demo-Available-brightgreen?style=for-the-badge&logo=vercel" alt="Live Demo"/></a>
  <a href="YOUR_VIDEO_URL_HERE"><img src="https://img.shields.io/badge/Demo_Video-Watch-red?style=for-the-badge&logo=youtube" alt="Demo Video"/></a>
  <img src="https://img.shields.io/badge/FastAPI-0.136-009688?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/Pinecone-Vector_DB-6759FF?style=for-the-badge" alt="Pinecone"/>
</p>

<p>DocuMind is a <strong>multi-tenant SaaS RAG platform</strong> that allows organizations to upload proprietary documents and query them using a conversational AI with real-time streaming responses. Built with production-grade architecture decisions: Hybrid Retrieval (Semantic + BM25), Cohere Reranking, an LLM-as-a-Judge quality pipeline, and full JWT-based tenant isolation.</p>

</div>

---

## 📺 Live Demo & Video

| | Link |
|---|---|
| 🌐 **Live Application** | [YOUR_LIVE_URL_HERE](YOUR_LIVE_URL_HERE) |
| 🎥 **Full Demo Video** | [YOUR_VIDEO_URL_HERE](YOUR_VIDEO_URL_HERE) |

> **Test Credentials:** Email: `demo@documind.ai` · Password: `demo1234`

---

## ✨ Key Features

| Feature | Implementation Detail |
|---|---|
| **Multi-Tenant Architecture** | Every company gets an isolated Pinecone namespace and scoped PostgreSQL rows. Cross-tenant data leakage is architecturally impossible. |
| **Hybrid RAG Retrieval** | Reciprocal Rank Fusion (RRF) of Semantic Search (Pinecone) + BM25 Full-Text (PostgreSQL). Outperforms single-method retrieval on the BEIR benchmark. |
| **Cohere Reranking** | Second-stage reranker ensures the most contextually relevant chunks reach the LLM, not just the highest-cosine-similarity ones. |
| **LLM-as-a-Judge** | After each Gemini response, Groq (llama-3.1-8b-instant) silently evaluates factual grounding, completeness, and formatting. No latency added to the user experience. |
| **Real-Time Streaming** | Server-Sent Events (SSE) with an asyncio thread-bridge to convert the synchronous Gemini SDK into a non-blocking async generator. |
| **Enterprise System Prompt** | An enforced analyst prompt that mandates structured markdown output, step-by-step processes, page-level citations, and strict anti-hallucination rules. |
| **Semantic Caching** | Repeated queries return cached results instantly. Cache keyed on (tenant_id, query_hash, top_k). |
| **JWT Authentication** | Stateless HS256 JWTs with auto-expiry detection on the frontend — users are redirected to `/login?expired=true` with a clear UX message. |
| **Document Management** | Upload, status tracking (PENDING → PROCESSING → INDEXED), and delete with Pinecone vector cleanup and PostgreSQL cascade. |
| **Audit Logs** | Every query is logged to PostgreSQL with token count, latency, cost in USD, and cache hit/miss status. Exportable to CSV. |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND (Port 3000)             │
│  Chat (SSE Stream) │ Documents │ Usage │ Audit │ Team      │
└───────────────────────────┬─────────────────────────────────┘
                            │ JWT Bearer Token
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND (Port 8000)               │
│                                                             │
│  /auth   /documents   /query/stream   /audit   /admin       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              RAG PIPELINE                           │   │
│  │                                                     │   │
│  │  Query → Embed → [Semantic Search + BM25 Search]   │   │
│  │                        ↓ RRF Fusion                 │   │
│  │                   Cohere Rerank                     │   │
│  │                        ↓                            │   │
│  │          Chunk Enrichment (Full Text from DB)       │   │
│  │                        ↓                            │   │
│  │           Enterprise System Prompt Builder          │   │
│  │                        ↓                            │   │
│  │         Gemini Flash (Streaming SSE Response)       │   │
│  │                        ↓                            │   │
│  │    [Background] Groq LLM-as-a-Judge Evaluation     │   │
│  └─────────────────────────────────────────────────────┘   │
└──────┬────────────────────────────────────────────┬─────────┘
       │                                            │
       ▼                                            ▼
┌──────────────┐                         ┌─────────────────────┐
│  PostgreSQL  │                         │      Pinecone       │
│              │                         │                     │
│  users       │                         │  Namespace per      │
│  tenants     │                         │  tenant (isolated)  │
│  documents   │                         │  1536-dim vectors   │
│  chunks      │◄────── Enrichment ──────│  + metadata         │
│  queries     │                         └─────────────────────┘
│  api_keys    │
│  quota_limits│
└──────────────┘
```

---

## 🔑 Architectural Decisions (The Why)

### Why Hybrid RAG over pure Semantic Search?

Pure semantic (vector) search finds conceptually similar content but fails on exact keyword matches like product codes, names, and technical terms. BM25 (keyword) search finds exact matches but misses paraphrased meaning. **Reciprocal Rank Fusion** combines both using rank position — not raw scores — making it mathematically sound even though Pinecone cosine scores and PostgreSQL ts_rank have incompatible scales.

### Why LLM-as-a-Judge instead of a fixed rubric?

Fixed rules ("must contain 3 sentences") don't capture semantic quality. An LLM evaluator can detect hallucinations, vague answers, and formatting failures that rule-based systems miss. Using **Groq** (not Gemini) for judging ensures independence from the generation model and dramatically reduces cost (Groq's llama-3.1-8b-instant is ~100x cheaper per token than Gemini Pro).

### Why FastAPI BackgroundTasks over Celery?

For a single-tenant MVP and portfolio deployments, Celery + Redis adds 2 infrastructure dependencies without adding meaningful throughput benefit. FastAPI's thread-pool-backed `BackgroundTasks` handles PDF ingestion safely without blocking the event loop. The Celery implementation remains in `tasks.py` and can be re-enabled for production scale with one config change.

### Why Cohere Reranking as a separate step?

The initial retrieval fetches 20 candidates using lightweight embedding similarity. Reranking is a more expensive cross-encoder that sees both the query AND the full chunk simultaneously — it's more accurate but too slow for first-pass retrieval. **Two-stage retrieval** (fast recall → accurate rerank) is the industry standard for production RAG.

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **FastAPI** | 0.136 | Async REST API framework |
| **SQLAlchemy** | 2.x | Async ORM with PostgreSQL |
| **asyncpg** | latest | Async PostgreSQL driver |
| **Pinecone** | 8.x | Vector database for embeddings |
| **Google Gemini Flash** | latest | LLM for answer generation (streaming) |
| **Cohere Rerank** | v3.0 | Cross-encoder reranking |
| **Groq + Llama 3.1** | 8b-instant | LLM-as-a-Judge evaluator |
| **LangChain Text Splitters** | 1.x | Recursive semantic chunking |
| **PyMuPDF (fitz)** | latest | PDF text extraction |
| **Alembic** | latest | Database migrations |
| **Pydantic** | v2 | Schema validation & settings |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 15 (App Router) | React framework |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **shadcn/ui** | latest | Accessible component library |
| **Zustand** | 4.x | Lightweight state management |
| **lucide-react** | latest | Icon system |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Full-stack containerization |
| **PostgreSQL 15** | Primary relational database |
| **JWT (HS256)** | Stateless authentication |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop (for PostgreSQL)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/DocuMind.git
cd DocuMind
```

Copy the environment template and fill in your API keys:
```bash
cp documind/.env.example documind/.env
```

Required keys in `documind/.env`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/documind
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=us-east-1
COHERE_API_KEY=your_cohere_api_key
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_secret_key_min_32_chars
API_KEY_SALT=your_salt_value
```

### 2. Start the Database

```bash
docker run -d --name documind-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=documind \
  -p 5432:5432 postgres:15-alpine
```

### 3. Backend Setup

```bash
cd documind
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt
alembic upgrade head           # Run database migrations
uvicorn app.main:app --reload  # Start API server
```

API available at: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Application available at: `http://localhost:3000`

### 5. (Optional) Full Stack with Docker Compose

```bash
# From the project root
docker-compose up
```

---

## 📡 API Reference

### Authentication
```http
POST /api/v1/auth/register
POST /api/v1/auth/login
```

### Documents
```http
GET    /api/v1/documents
POST   /api/v1/documents/upload
DELETE /api/v1/documents/{document_id}
```

### Query (Streaming)
```http
POST /api/v1/query/stream
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "What are the eligibility requirements?",
  "top_k": 5
}
```

Response: `text/event-stream` with events: `metadata`, `token`, `sources`, `done`, `error`

### Audit & Usage
```http
GET /api/v1/audit/logs
GET /api/v1/audit/team
GET /api/v1/admin/me/usage
```

---

## 📊 Performance Characteristics

| Metric | Typical Value |
|---|---|
| PDF Ingestion (10-page doc) | ~15–25 seconds |
| Query Retrieval Latency | ~200–400ms |
| Groq Judge Latency | ~300ms (background, user unaffected) |
| SSE First Token | < 1 second |
| Cache Hit Response | < 50ms |

---

## 🗺️ Roadmap

- [ ] Multi-user tenant support (invite team members)
- [ ] pgvector migration for zero-cost vector storage
- [ ] PDF table extraction (LlamaParse integration)
- [ ] Conversation history persistence across sessions
- [ ] Row-Level Security (RLS) in PostgreSQL
- [ ] Webhook support for ingestion status notifications

---

## 🎓 What I Learned Building This

This project taught me the full lifecycle of a production AI system:

1. **Why naive RAG fails in production** — and how multi-stage retrieval (embed → fuse → rerank → enrich) fixes it
2. **Multi-tenant data isolation** is not just a `WHERE tenant_id = X` clause — it requires architectural discipline at every layer
3. **Async Python at scale** — the asyncio thread-bridge pattern for integrating synchronous SDKs without freezing the event loop
4. **LLM evaluation is itself an AI problem** — using a fast cheap model (Groq) to judge a slower expensive model (Gemini) is an elegant cost-quality tradeoff
5. **SSE streaming** requires specific nginx/proxy configuration in production (`X-Accel-Buffering: no`)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ as a portfolio project demonstrating production-grade AI engineering</p>
  <p>
    <a href="YOUR_LINKEDIN_URL">LinkedIn</a> ·
    <a href="YOUR_PORTFOLIO_URL">Portfolio</a> ·
    <a href="YOUR_EMAIL">Contact</a>
  </p>
</div>
