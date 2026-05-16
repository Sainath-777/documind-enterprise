from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.database import get_db
from app.models.tenant import User, Tenant
from app.schemas.auth import UserRegister, UserLogin, Token, TenantResponse
from app.services import auth_service
from app.core.security import verify_password, create_access_token, create_refresh_token

router = APIRouter()


@router.post("/register", response_model=TenantResponse)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="User already registered")

    user, tenant, raw_key = await auth_service.create_tenant_user(db, user_in)
    return {
        "user_id": user.id,
        "tenant_id": tenant.id,
        "api_key": raw_key,
        "tier": tenant.tier
    }


@router.post("/login", response_model=Token)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == user_in.email)
    )
    user = result.scalars().first()

    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    result = await db.execute(
        select(Tenant).where(Tenant.owner_user_id == user.id)
    )
    tenant = result.scalars().first()

    access_token = create_access_token(
        data={"sub": str(user.id), "tenant_id": str(tenant.id)}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
