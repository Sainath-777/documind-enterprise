import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class DocumentUploadResponse(BaseModel):
    job_id: str
    document_id: uuid.UUID
    status: str
    estimated_time: str


class DocumentListItem(BaseModel):
    id: uuid.UUID
    filename: str
    processing_status: str
    chunk_count: int
    upload_date: datetime
    file_size_bytes: Optional[int]

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentListItem]
    total: int


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    current_step: str
    total_chunks: int
    processed_chunks: int
    errors: list[str]
