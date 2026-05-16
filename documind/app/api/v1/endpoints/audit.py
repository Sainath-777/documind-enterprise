import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from app.models.database import get_db
from app.models.query import Query
from app.models.tenant import User, Tenant
from app.api.v1.dependencies import get_current_tenant_id

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Return recent query logs for this tenant as audit trail."""
    result = await db.execute(
        select(Query)
        .where(Query.tenant_id == uuid.UUID(tenant_id))
        .order_by(desc(Query.timestamp))
        .limit(limit)
    )
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "event": "query.executed",
                "query_text": log.query_text,
                "tokens_used": log.tokens_used,
                "cost_usd": float(log.cost_usd) if log.cost_usd else 0.0,
                "retrieval_latency_ms": log.retrieval_latency_ms,
                "cache_hit": log.cache_hit,
                "rerank_applied": log.rerank_applied,
                "chunks_retrieved": log.chunks_retrieved,
                "status": "success",
            }
            for log in logs
        ],
        "total": len(logs),
    }


@router.get("/team")
async def get_team_members(
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """Return current user and tenant info as the 'team'."""
    # Get tenant + owner user
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == uuid.UUID(tenant_id))
    )
    tenant = tenant_result.scalars().first()

    if not tenant:
        return {"members": [], "total": 0}

    user_result = await db.execute(
        select(User).where(User.id == tenant.owner_user_id)
    )
    user = user_result.scalars().first()

    members = []
    if user:
        members.append({
            "id": str(user.id),
            "email": user.email,
            "name": user.email.split("@")[0].replace(".", " ").title(),
            "role": "Admin",
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "avatar": "".join([w[0].upper() for w in user.email.split("@")[0].split(".")[:2]]),
            "company": tenant.company_name,
            "tier": tenant.tier.value,
        })

    return {"members": members, "total": len(members)}
