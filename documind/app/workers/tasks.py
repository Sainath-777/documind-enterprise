import asyncio
import tempfile
import os
import json
import uuid
from celery import shared_task
from app.workers.celery_app import celery_app
from app.core.logging import logger
from langfuse import observe

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="ingest_document")
@observe(name="document_ingestion")
def ingest_document(self, document_id: str, tenant_id: str, namespace: str, file_path: str):
    """Main ingestion task. Runs the full pipeline synchronously inside Celery."""
    from app.models.document import ProcessingStatus
    from sqlalchemy import create_engine, select, update, func
    from sqlalchemy.orm import Session
    from app.core.config import settings
    from app.models.tenant import Tenant
    from app.models.document import Document, Chunk
    from app.services.ingestion.pdf_processor import extract_text_from_pdf
    from app.services.ingestion.chunker import chunk_pages
    from app.services.ingestion.embedder import generate_embeddings
    from app.services.ingestion.uploader import upsert_chunks_to_pinecone

    # Use synchronous SQLAlchemy for Celery (not async)
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
    engine = create_engine(sync_url)

    redis_key = f"job:{self.request.id}:progress"

    def update_progress(step: str, processed: int, total: int):
        import redis as redis_lib
        r = redis_lib.from_url(settings.REDIS_URL)
        r.setex(redis_key, 3600, json.dumps({
            "total_chunks": total,
            "processed_chunks": processed,
            "current_step": step,
            "percentage": int((processed / max(total, 1)) * 100),
        }))

    try:
        with Session(engine) as db:
            # Mark as PROCESSING
            db.execute(update(Document).where(Document.id == uuid.UUID(document_id))
                       .values(processing_status=ProcessingStatus.PROCESSING))
            db.commit()

        # Step 1: Extract text
        update_progress("extracting", 0, 1)
        pages = extract_text_from_pdf(file_path)

        # Step 2: Chunk
        update_progress("chunking", 0, 1)
        chunks = chunk_pages(pages)

        total = len(chunks)
        update_progress("embedding", 0, total)

        # Step 3: Generate embeddings
        texts = [c["text"] for c in chunks]
        embeddings = asyncio.run(generate_embeddings(texts))

        update_progress("uploading", 0, total)

        # Step 4: Upsert to Pinecone
        upsert_chunks_to_pinecone(namespace, chunks, embeddings, document_id)

        # Step 5: Save chunks to DB and mark COMPLETED
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
            db.execute(update(Document).where(Document.id == uuid.UUID(document_id))
                       .values(processing_status=ProcessingStatus.COMPLETED, chunk_count=total))
            db.commit()

        update_progress("completed", total, total)
        logger.info("ingestion_complete", document_id=document_id, chunks=total)
        # Delete temp file on success
        if os.path.exists(file_path):
            os.remove(file_path)

    except Exception as exc:
        with Session(engine) as db:
            db.execute(update(Document).where(Document.id == uuid.UUID(document_id))
                       .values(processing_status=ProcessingStatus.FAILED, error_message=str(exc)))
            db.commit()
        logger.error("ingestion_failed", document_id=document_id, error=str(exc))
        
        # Only delete file if we are out of retries
        if self.request.retries >= self.max_retries:
            if os.path.exists(file_path):
                os.remove(file_path)
                
        raise self.retry(exc=exc)


@celery_app.task(name="sync_redis_usage")
def sync_redis_usage():
    """
    Hourly job: reads Redis usage counters -> upserts UsageLog rows -> resets counters.
    Uses synchronous SQLAlchemy.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.core.config import settings
    from app.models.usage import UsageLog
    import redis as redis_lib
    from datetime import datetime, timezone
    import uuid

    r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
    engine = create_engine(sync_url)
    
    # scan for all queries keys
    keys = list(r.scan_iter("usage:*:queries"))
    
    for key in keys:
        try:
            tenant_id = key.split(":")[1]
            
            pipe = r.pipeline()
            # GET then DEL atomically
            pipe.get(f"usage:{tenant_id}:queries")
            pipe.delete(f"usage:{tenant_id}:queries")
            
            pipe.get(f"usage:{tenant_id}:tokens")
            pipe.delete(f"usage:{tenant_id}:tokens")
            
            pipe.get(f"usage:{tenant_id}:documents")
            pipe.delete(f"usage:{tenant_id}:documents")
            
            result = pipe.execute()
            
            queries = int(result[0] or 0)
            tokens = int(result[2] or 0)
            docs = int(result[4] or 0)
            
            if queries == 0 and tokens == 0 and docs == 0:
                continue
                
            now = datetime.now(timezone.utc)
            start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
            
            with Session(engine) as db:
                usage_log = db.query(UsageLog).filter(
                    UsageLog.tenant_id == uuid.UUID(tenant_id),
                    UsageLog.period_start == start_of_month
                ).first()
                
                if not usage_log:
                    usage_log = UsageLog(
                        tenant_id=uuid.UUID(tenant_id),
                        period_start=start_of_month,
                        queries_count=queries,
                        tokens_consumed=tokens,
                        documents_added=docs,
                        cost_usd=round(tokens * 0.0000005, 6)
                    )
                    db.add(usage_log)
                else:
                    usage_log.queries_count += queries
                    usage_log.tokens_consumed += tokens
                    usage_log.documents_added += docs
                    usage_log.cost_usd = float(usage_log.cost_usd) + round(tokens * 0.0000005, 6)
                    
                db.commit()
                from app.core.logging import logger
                logger.info("synced_usage", tenant_id=tenant_id, queries=queries)
                
        except Exception as exc:
            from app.core.logging import logger
            logger.error("sync_usage_failed", key=key, error=str(exc))
