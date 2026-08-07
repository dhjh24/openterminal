from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from backend.config.env import load_local_env
from backend.config.settings import get_settings


def _ensure_sqlite_parent(url: str) -> None:
    if url in {"sqlite://", "sqlite+aiosqlite://", "sqlite:///:memory:", "sqlite+aiosqlite:///:memory:"}:
        return
    prefixes = ("sqlite+aiosqlite:///", "sqlite:///")
    for prefix in prefixes:
        if not url.startswith(prefix):
            continue
        raw_path = url.removeprefix(prefix)
        if not raw_path or raw_path == ":memory:":
            return
        # If it's a Windows path like C:/, resolve() handles it
        import pathlib
        pathlib.Path(raw_path).resolve().parent.mkdir(parents=True, exist_ok=True)
        return


def sqlite_file_from_url(url: str, *, fallback: Path | None = None) -> Path:
    if url.startswith("sqlite+aiosqlite:////"):
        return Path(f"/{url.removeprefix('sqlite+aiosqlite:////')}").resolve()
    if url.startswith("sqlite+aiosqlite:///"):
        return Path(url.removeprefix("sqlite+aiosqlite:///")).resolve()
    if url.startswith("sqlite:////"):
        return Path(f"/{url.removeprefix('sqlite:////')}").resolve()
    if url.startswith("sqlite:///"):
        return Path(url.removeprefix("sqlite:///")).resolve()
    if url.startswith("sqlite+aiosqlite://"):
        return Path(url.removeprefix("sqlite+aiosqlite://")).resolve()
    if url.startswith("sqlite://"):
        return Path(url.removeprefix("sqlite://")).resolve()
    return (fallback or Path("./backend/openterminalui.db")).resolve()


def _raw_database_url() -> str:
    load_local_env()
    settings = get_settings()
    raw = os.getenv("DATABASE_URL")
    if not raw:
        raw = settings.sqlite_url
    return raw


def get_database_direct_url() -> str:
    load_local_env()
    raw = os.getenv("DATABASE_DIRECT_URL") or os.getenv("DATABASE_URL")
    if not raw:
        raw = get_settings().sqlite_url
    return raw


def _asyncpg_safe_url(raw: str) -> tuple[str, dict]:
    """Prepare a PostgreSQL URL for asyncpg (Neon direct/pooled endpoints).

    Neon hands out URLs like
    ``postgresql://user:pass@host/db?sslmode=require&channel_binding=require``.
    psycopg accepts those query params, asyncpg does not — SQLAlchemy forwards
    them as ``connect()`` kwargs and asyncpg raises ``TypeError``. Strip them
    and translate ``sslmode=require|verify-*`` into asyncpg's ``ssl='require'``
    connect arg (encrypted, no client-side cert verification).

    Returns ``(cleaned_url, connect_args)``. SQLite/other URLs pass through
    with empty connect args.
    """
    connect_args: dict = {}
    if "?" not in raw:
        return raw, connect_args
    base, _, query = raw.partition("?")
    kept: list[str] = []
    for pair in query.split("&"):
        key, _, value = pair.partition("=")
        if key == "sslmode":
            if value in {"require", "verify-ca", "verify-full"}:
                connect_args = {"ssl": "require"}
            continue
        if key == "channel_binding":
            continue
        kept.append(pair)
    url = f"{base}?{'&'.join(kept)}" if kept else base
    return url, connect_args


def get_database_url() -> str:
    # Use DATABASE_URL if provided (e.g. for PostgreSQL in prod)
    # Otherwise use settings.sqlite_url (which already handles OPENTERMINALUI_SQLITE_URL)
    raw = _raw_database_url()
    if raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
        raw, _ = _asyncpg_safe_url(raw)
        return raw

    # If it's a standard sqlite URL, convert to aiosqlite for async usage
    if raw.startswith("sqlite:///") and not raw.startswith("sqlite+aiosqlite:///"):
        raw = raw.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    elif raw.startswith("sqlite://") and not raw.startswith("sqlite+aiosqlite://") and not raw.startswith("sqlite:///"):
        raw = raw.replace("sqlite://", "sqlite+aiosqlite://", 1)

    _ensure_sqlite_parent(raw)
    return raw


def get_sync_database_url() -> str:
    raw = _raw_database_url()

    if raw.startswith("postgresql+asyncpg://"):
        return raw.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+psycopg://", 1)

    if raw.startswith("sqlite+aiosqlite:///"):
        raw = raw.replace("sqlite+aiosqlite:///", "sqlite:///", 1)
    elif raw.startswith("sqlite+aiosqlite://") and not raw.startswith("sqlite+aiosqlite:///"):
        raw = raw.replace("sqlite+aiosqlite://", "sqlite://", 1)

    _ensure_sqlite_parent(raw)
    return raw


def create_engine_async() -> AsyncEngine:
    raw = _raw_database_url()
    _, connect_args = _asyncpg_safe_url(raw)
    return create_async_engine(
        get_database_url(), future=True, pool_pre_ping=True, connect_args=connect_args
    )
