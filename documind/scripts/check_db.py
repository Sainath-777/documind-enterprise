import asyncio
from app.models.database import engine
from sqlalchemy import text


async def check() -> None:
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        )
        tables = [r[0] for r in result]
        print(f"Found {len(tables)} tables:")
        for t in sorted(tables):
            print(f"  ✅ {t}")


asyncio.run(check())
