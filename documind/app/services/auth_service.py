import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.tenant import User, Tenant, APIKey, TenantTier
from app.models.usage import QuotaLimit
from app.core.security import get_password_hash, generate_api_key, pwd_context
from app.schemas.auth import UserRegister


async def create_tenant_user(db: AsyncSession, user_in: UserRegister):
    # 1. Create User
    new_user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password)
    )
    db.add(new_user)
    await db.flush()

    # 2. Create Tenant
    tenant_id = uuid.uuid4()
    new_tenant = Tenant(
        id=tenant_id,
        company_name=user_in.company_name,
        owner_user_id=new_user.id,
        pinecone_namespace=f"tenant_{tenant_id.hex}",
        tier=TenantTier.FREE
    )
    db.add(new_tenant)
    await db.flush()

    # 3. Create initial API Key
    raw_key = generate_api_key()
    new_key = APIKey(
        tenant_id=new_tenant.id,
        key_hash=pwd_context.hash(raw_key), # We use bcrypt for key hashing too
        prefix=raw_key[:12] # sk_live_...
    )
    db.add(new_key)

    # 4. Create Quota Limits
    new_quota = QuotaLimit(
        tenant_id=new_tenant.id,
        max_queries_per_month=1000,
        max_documents=100,
        max_tokens_per_month=10_000_000
    )
    db.add(new_quota)

    await db.commit()
    return new_user, new_tenant, raw_key
