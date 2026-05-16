from fastapi import HTTPException, status


class DocuMindException(Exception):
    """Base exception for all DocuMind errors."""
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(self.message)


class TenantNotFoundException(DocuMindException):
    pass


class QuotaExceededException(DocuMindException):
    pass


class RateLimitExceededException(DocuMindException):
    pass


class DocumentProcessingException(DocuMindException):
    pass


class InvalidAPIKeyException(DocuMindException):
    pass


class StorageQuotaExceededException(DocuMindException):
    pass


# HTTP-mapped exceptions (for FastAPI endpoints)
def raise_not_found(entity: str, entity_id: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{entity} with id '{entity_id}' not found.",
    )


def raise_quota_exceeded(resource: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Quota exceeded for resource: {resource}.",
    )


def raise_unauthorized(detail: str = "Authentication required.") -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )
