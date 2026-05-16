from fastapi import APIRouter
from app.api.v1.endpoints import auth, documents, status, query, query_stream, admin, audit

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(status.router, prefix="/status", tags=["Status"])
api_router.include_router(query.router, prefix="/query", tags=["Query"])
api_router.include_router(query_stream.router, prefix="/query", tags=["Query - Stream"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])