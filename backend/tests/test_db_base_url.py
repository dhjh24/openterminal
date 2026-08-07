from __future__ import annotations

import os
from pathlib import Path

from backend.db.base import (
    _asyncpg_safe_url,
    create_engine_async,
    get_database_direct_url,
    get_database_url,
    get_sync_database_url,
    sqlite_file_from_url,
)
from backend.config.settings import get_settings


def test_get_database_url_syncs_with_settings(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    import sys
    import tempfile
    tmp = tempfile.gettempdir().replace("\\", "/")
    if sys.platform.startswith("win"):
        test_url = f"sqlite:///{tmp}/otui_test/test.db"
        expected_url = f"sqlite+aiosqlite:///{tmp}/otui_test/test.db"
    else:
        test_url = f"sqlite:///{tmp}/otui_test/test.db"
        expected_url = f"sqlite+aiosqlite:///{tmp}/otui_test/test.db"

    monkeypatch.setenv("OPENTERMINALUI_SQLITE_URL", test_url)
    get_settings.cache_clear()

    url = get_database_url()
    assert url == expected_url


def test_get_database_url_respects_database_url_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host/db")
    get_settings.cache_clear()

    url = get_database_url()
    assert url == "postgresql+asyncpg://user:pass@host/db"


def test_get_sync_database_url_respects_database_url_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host/db")
    get_settings.cache_clear()

    url = get_sync_database_url()
    assert url == "postgresql+psycopg://user:pass@host/db"


def test_get_database_direct_url_prefers_direct_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://pool:pass@pool-host/db")
    monkeypatch.setenv("DATABASE_DIRECT_URL", "postgresql://direct:pass@direct-host/db")
    get_settings.cache_clear()

    assert get_database_direct_url() == "postgresql://direct:pass@direct-host/db"


def test_get_database_direct_url_falls_back_to_database_url(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://pool:pass@pool-host/db")
    monkeypatch.delenv("DATABASE_DIRECT_URL", raising=False)
    get_settings.cache_clear()

    assert get_database_direct_url() == "postgresql://pool:pass@pool-host/db"


def test_get_sync_database_url_normalizes_aiosqlite(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:////tmp/openterminalui.db")
    get_settings.cache_clear()

    url = get_sync_database_url()
    assert url == "sqlite:////tmp/openterminalui.db"


def test_sqlite_file_from_url_supports_async_sqlite_urls() -> None:
    path = sqlite_file_from_url("sqlite+aiosqlite:////tmp/openterminalui.db")
    assert path == Path("/tmp/openterminalui.db").resolve()


def test_get_database_url_default_is_workspace_local(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("OPENTERMINALUI_SQLITE_URL", raising=False)
    monkeypatch.delenv("OPENSCREENS_SQLITE_URL", raising=False)
    monkeypatch.delenv("TRADE_SCREENS_SQLITE_URL", raising=False)
    get_settings.cache_clear()

    url = get_database_url()
    expected_path = (Path(__file__).resolve().parents[2] / "data" / "openterminalui.db").resolve()
    assert url == f"sqlite+aiosqlite:///{expected_path.as_posix()}"


# ── asyncpg URL safety (Neon sslmode/channel_binding) ─────────────────────


def test_asyncpg_safe_url_strips_sslmode_and_channel_binding() -> None:
    url, connect_args = _asyncpg_safe_url(
        "postgresql://user:pass@host/db?sslmode=require&channel_binding=require"
    )
    assert url == "postgresql://user:pass@host/db"
    assert connect_args == {"ssl": "require"}


def test_asyncpg_safe_url_keeps_other_query_params() -> None:
    url, connect_args = _asyncpg_safe_url(
        "postgresql://user:pass@host/db?sslmode=require&application_name=otui"
    )
    assert url == "postgresql://user:pass@host/db?application_name=otui"
    assert connect_args == {"ssl": "require"}


def test_asyncpg_safe_url_passthrough_without_query() -> None:
    url, connect_args = _asyncpg_safe_url("postgresql://user:pass@host/db")
    assert url == "postgresql://user:pass@host/db"
    assert connect_args == {}


def test_asyncpg_safe_url_verify_full_maps_to_ssl_require() -> None:
    url, connect_args = _asyncpg_safe_url(
        "postgresql://user:pass@host/db?sslmode=verify-full&channel_binding=require"
    )
    assert url == "postgresql://user:pass@host/db"
    assert connect_args == {"ssl": "require"}


def test_asyncpg_safe_url_sslmode_disable_no_ssl_arg() -> None:
    url, connect_args = _asyncpg_safe_url("postgresql://user:pass@host/db?sslmode=disable")
    assert url == "postgresql://user:pass@host/db"
    assert connect_args == {}


def test_get_database_url_strips_neon_params(monkeypatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:pass@host/db?sslmode=require&channel_binding=require",
    )
    get_settings.cache_clear()

    url = get_database_url()
    assert url == "postgresql+asyncpg://user:pass@host/db"


def test_create_engine_async_forwards_ssl_connect_arg(monkeypatch) -> None:
    import backend.db.base as db_base

    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:pass@host/db?sslmode=require&channel_binding=require",
    )
    get_settings.cache_clear()

    captured: dict = {}

    def fake_create(url: str, **kwargs) -> str:
        captured["url"] = url
        captured["kwargs"] = kwargs
        return "engine"

    monkeypatch.setattr(db_base, "create_async_engine", fake_create)

    assert create_engine_async() == "engine"
    assert captured["url"] == "postgresql+asyncpg://user:pass@host/db"
    assert captured["kwargs"]["connect_args"] == {"ssl": "require"}
