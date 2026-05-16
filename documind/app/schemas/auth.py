import uuid
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    company_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str


class TenantResponse(BaseModel):
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    api_key: str
    tier: str


class APIKeyResponse(BaseModel):
    api_key: str
