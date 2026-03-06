from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    poolclass=NullPool  # Disable pooling for compatibility with Celery + asyncio.run()
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevent attribute expiry after commit (needed for Celery async tasks)
)

async def get_db():
    async with SessionLocal() as session:
        yield session
