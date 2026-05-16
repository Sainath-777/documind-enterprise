import uuid
import tempfile
import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.database import get_db
from app.models.document import Document, ProcessingStatus
from app.models.tenant import Tenant
from app.schemas.document import DocumentUploadResponse, DocumentListResponse, DocumentListItem
from app.api.v1.dependencies import get_current_tenant_id
from app.services.cache.semantic_cache import invalidate_tenant_cache
from app.services.quotas.usage_tracker import check_document_quota, increment_document_usage
from app.services.quotas.rate_limiter import check_rate_limit

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Get tenant namespace
    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    check_rate_limit(tenant_id, "document_upload")
    await check_document_quota(tenant_id, db)

    # Save file temporarily
    content = await file.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(content)
    tmp.close()

    # Create document record
    doc = Document(
        tenant_id=uuid.UUID(tenant_id),
        filename=file.filename,
        file_size_bytes=len(content),
        processing_status=ProcessingStatus.PENDING,
    )
    db.add(doc)
    await db.commit()

    # Invalidate tenant cache
    invalidate_tenant_cache(tenant_id)
    increment_document_usage(tenant_id)

    # ── Fire ingestion as a FastAPI BackgroundTask (no Celery/Redis needed) ──
    from app.services.ingestion.ingestor import run_ingestion
    background_tasks.add_task(
        run_ingestion,
        str(doc.id),
        tenant_id,
        tenant.pinecone_namespace,
        tmp.name,
    )

    return {
        "job_id": str(doc.id),   # use doc id as job reference
        "document_id": doc.id,
        "status": "processing",
        "estimated_time": "30s",
    }


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    result = await db.execute(
        select(Document)
        .where(Document.tenant_id == uuid.UUID(tenant_id))
        .order_by(Document.upload_date.desc())
    )
    docs = result.scalars().all()
    return {"documents": docs, "total": len(docs)}


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    # Verify ownership
    result = await db.execute(
        select(Document)
        .where(Document.id == uuid.UUID(document_id), Document.tenant_id == uuid.UUID(tenant_id))
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get namespace
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = tenant_res.scalars().first()

    # Delete from Pinecone
    try:
        from app.services.ingestion.uploader import delete_document_from_pinecone
        delete_document_from_pinecone(tenant.pinecone_namespace, document_id)
    except Exception as e:
        # Log but don't fail the API request if pinecone delete fails
        pass

    # Delete from DB (Chunks are cascade deleted)
    await db.delete(doc)
    await db.commit()

    # Invalidate Cache
    invalidate_tenant_cache(tenant_id)
    
    return {"status": "success", "message": "Document deleted"}
