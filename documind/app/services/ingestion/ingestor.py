"""
Async ingestion pipeline — replaces the old Celery task.
Called directly by FastAPI BackgroundTasks, no Redis or worker process needed.
"""

import asyncio
import os
import uuid
from sqlalchemy import create_engine, update, func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger


def run_ingestion(document_id: str, tenant_id: str, namespace: str, file_path: str) -> None:
    """
    Synchronous ingestion pipeline.
    FastAPI runs this in a thread-pool via BackgroundTasks so it won't block
    the event loop.  All heavy I/O (PDF parsing, embedding, Pinecone upsert)
    is synchronous, matching the old Celery task exactly.
    """
    from app.models.document import Document, Chunk, ProcessingStatus
    from app.services.ingestion.pdf_processor import extract_text_from_pdf
    from app.services.ingestion.chunker import chunk_pages
    from app.services.ingestion.embedder import generate_embeddings
    from app.services.ingestion.uploader import upsert_chunks_to_pinecone

    # Synchronous DB connection (same pattern as old Celery task)
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
    engine = create_engine(sync_url)

    try:
        # ── Mark as PROCESSING ─────────────────────────────────────────────
        with Session(engine) as db:
            db.execute(
                update(Document)
                .where(Document.id == uuid.UUID(document_id))
                .values(processing_status=ProcessingStatus.PROCESSING)
            )
            db.commit()

        logger.info("ingestion_started", document_id=document_id)

        # ── Step 1: Extract text from PDF ──────────────────────────────────
        pages = extract_text_from_pdf(file_path)

        # ── Step 2: Chunk (RecursiveCharacterTextSplitter already in chunker.py)
        chunks = chunk_pages(pages)
        total = len(chunks)

        logger.info("ingestion_chunked", document_id=document_id, chunks=total)

        # ── Step 3: Generate embeddings ────────────────────────────────────
        texts = [c["text"] for c in chunks]
        # generate_embeddings is async — run it safely from sync context
        embeddings = asyncio.run(generate_embeddings(texts))

        # ── Step 4: Upsert to Pinecone ─────────────────────────────────────
        upsert_chunks_to_pinecone(namespace, chunks, embeddings, document_id)

        logger.info("ingestion_pinecone_done", document_id=document_id)

        # ── Step 5: Persist chunks to DB & mark COMPLETED ──────────────────
        with Session(engine) as db:
            for chunk in chunks:
                db.add(Chunk(
                    document_id=uuid.UUID(document_id),
                    tenant_id=uuid.UUID(tenant_id),
                    chunk_index=chunk["chunk_index"],
                    text=chunk["text"],
                    text_vector=func.to_tsvector("english", chunk["text"]),
                    page_number=chunk.get("page_number"),
                    pinecone_id=f"{document_id}_chunk_{chunk['chunk_index']}",
                ))
            db.execute(
                update(Document)
                .where(Document.id == uuid.UUID(document_id))
                .values(processing_status=ProcessingStatus.COMPLETED, chunk_count=total)
            )
            db.commit()

        logger.info("ingestion_complete", document_id=document_id, chunks=total)

    except Exception as exc:
        logger.error("ingestion_failed", document_id=document_id, error=str(exc))
        with Session(engine) as db:
            db.execute(
                update(Document)
                .where(Document.id == uuid.UUID(document_id))
                .values(processing_status=ProcessingStatus.FAILED, error_message=str(exc))
            )
            db.commit()

    finally:
        # Always clean up the temp file
        if os.path.exists(file_path):
            os.remove(file_path)
        engine.dispose()
