from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.config import settings
from app.core.security import ALGORITHM, pwd_context
from app.models.database import get_db
from app.models.tenant import APIKey

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_tenant_id(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> str:
    """Dependency for dashboard/admin actions using JWT."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        tenant_id: str = payload.get("tenant_id")
        if tenant_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    return tenant_id


async def verify_api_key(
    x_api_key: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> str:
    """Dependency for RAG API actions using x-api-key."""
    # Find all keys for the prefix
    prefix = x_api_key[:12]
    result = await db.execute(
        select(APIKey).where(APIKey.prefix == prefix, APIKey.is_active == True)
    )
    keys = result.scalars().all()
    
    for key in keys:
        if pwd_context.verify(x_api_key, key.key_hash):
            return str(key.tenant_id)
            
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or inactive API Key"
    )
