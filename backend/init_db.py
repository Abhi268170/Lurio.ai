import asyncio
from app.db.base_class import Base
from app.db.session import engine
import app.models  # This triggers the imports inside __init__.py so models are attached to Base.metadata

async def init_models():
    async with engine.begin() as conn:
        print("Creating all tables in the database...")
        await conn.run_sync(Base.metadata.create_all)
        print("Done.")

if __name__ == "__main__":
    asyncio.run(init_models())
