from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "DocuMind"
    APP_ENV: str = "development"
    APP_VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis (optional — only needed if semantic cache is enabled)
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # External APIs
    GEMINI_API_KEY: str
    OPENAI_API_KEY: str = ""
    PINECONE_API_KEY: str
    PINECONE_ENVIRONMENT: str
    COHERE_API_KEY: str = ""
    GROQ_API_KEY: str = ""  # Used by the LLM-as-a-Judge background evaluator

    # Security
    SECRET_KEY: str
    API_KEY_SALT: str
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Feature Flags
    ENABLE_RERANKING: bool = True
    ENABLE_SEMANTIC_CACHE: bool = True
    ENABLE_RATE_LIMITING: bool = True

    # Observability
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: str = ""


settings = Settings()
