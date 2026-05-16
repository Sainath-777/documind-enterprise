import uuid
from datetime import datetime
from sqlalchemy import Integer, BigInteger, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.database import Base


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    queries_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tokens_consumed: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    documents_added: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class QuotaLimit(Base):
    __tablename__ = "quota_limits"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    max_queries_per_month: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    max_documents: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    max_storage_bytes: Mapped[int] = mapped_column(BigInteger, default=1_073_741_824, nullable=False)  # 1GB
    max_tokens_per_month: Mapped[int] = mapped_column(BigInteger, default=10_000_000, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="quota_limit")
