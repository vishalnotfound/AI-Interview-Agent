"""
Async SQLAlchemy engine & session factory for PostgreSQL (Neon / Aiven / etc.).
"""
import os
import ssl
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse

load_dotenv()
logger = logging.getLogger("database")

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ── Auto-fix scheme: psql/raw URLs use "postgresql://" but SQLAlchemy async
#    requires "postgresql+asyncpg://".  Handle both cases gracefully.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    logger.info("Auto-converted postgresql:// → postgresql+asyncpg://")

# ── Strip query params that asyncpg does NOT understand ──
# asyncpg chokes on: sslmode, ssl, channel_binding, options, etc.
# We handle SSL via a Python ssl context in connect_args instead.
_STRIP_PARAMS = {"sslmode", "ssl", "channel_binding"}
_connect_args = {}

parsed = urlparse(DATABASE_URL)
qs = parse_qsl(parsed.query)
_needs_ssl = any(k in ("sslmode", "ssl") and v == "require" for k, v in qs)
qs_clean = [(k, v) for k, v in qs if k not in _STRIP_PARAMS]
DATABASE_URL = urlunparse(parsed._replace(query=urlencode(qs_clean)))

if _needs_ssl:
    ssl_ctx = ssl.create_default_context()
    # Neon pooler endpoints use PgBouncer — the TLS cert is issued for the
    # pooler hostname but the underlying server may present a different CN.
    # Relax hostname checking so connections don't fail with a mismatch.
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = ssl_ctx

logger.info(f"Database URL (sanitized): {DATABASE_URL[:50]}...")

is_neon_pooler = "-pooler." in DATABASE_URL
engine_kwargs = {
    "echo": False,
    "connect_args": _connect_args,
}

if is_neon_pooler:
    logger.info("Neon pooler detected. Using NullPool and disabling prepared statements.")
    engine_kwargs["poolclass"] = NullPool
    _connect_args["prepared_statement_cache_size"] = 0
    _connect_args["statement_cache_size"] = 0
else:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

# Create async engine
engine = create_async_engine(DATABASE_URL, **engine_kwargs)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency — yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create all tables defined by Base subclasses."""
    import models.db_models  # Ensure models are registered with Base.metadata before creation
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created / verified.")
