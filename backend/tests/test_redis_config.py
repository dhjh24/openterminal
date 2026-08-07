"""Tests for the central Redis client builder (backend/config/redis.py).

The quote bus and the multi-tier cache both build their clients through
``build_redis_client`` so connection hygiene (timeouts, keepalive, retry)
lives in one place and remote Redis VMs are configured with a single
``REDIS_URL`` env var.
"""

from __future__ import annotations

import backend.config.redis as redis_config


def test_defaults_to_localhost_when_no_env(monkeypatch) -> None:
    monkeypatch.delenv("REDIS_URL", raising=False)
    captured: dict = {}

    def fake_from_url(url: str, **kwargs) -> str:
        captured["url"] = url
        captured["kwargs"] = kwargs
        return url

    monkeypatch.setattr(redis_config.aioredis, "from_url", fake_from_url)

    result = redis_config.build_redis_client()
    assert result == "redis://localhost:6379/0"
    assert captured["url"] == "redis://localhost:6379/0"


def test_uses_redis_url_env(monkeypatch) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://app:***@redis.internal:6379/0")
    captured: dict = {}

    def fake_from_url(url: str, **kwargs) -> str:
        captured["url"] = url
        return url

    monkeypatch.setattr(redis_config.aioredis, "from_url", fake_from_url)

    assert redis_config.build_redis_client() == "redis://app:***@redis.internal:6379/0"
    assert captured["url"] == "redis://app:***@redis.internal:6379/0"


def test_explicit_url_wins_over_env(monkeypatch) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://env:6379/0")
    captured: dict = {}

    def fake_from_url(url: str, **kwargs) -> str:
        captured["url"] = url
        return url

    monkeypatch.setattr(redis_config.aioredis, "from_url", fake_from_url)

    redis_config.build_redis_client("redis://explicit:6379/1")
    assert captured["url"] == "redis://explicit:6379/1"


def test_connection_hygiene_kwargs_always_applied(monkeypatch) -> None:
    monkeypatch.delenv("REDIS_URL", raising=False)
    captured: dict = {}

    def fake_from_url(url: str, **kwargs) -> str:
        captured["kwargs"] = kwargs
        return url

    monkeypatch.setattr(redis_config.aioredis, "from_url", fake_from_url)

    redis_config.build_redis_client()
    kwargs = captured["kwargs"]
    assert kwargs["socket_connect_timeout"] == 2
    assert kwargs["socket_timeout"] == 2
    assert kwargs["socket_keepalive"] is True
    assert kwargs["retry_on_timeout"] is True
    assert kwargs["health_check_interval"] == 10


def test_caller_kwargs_override_defaults(monkeypatch) -> None:
    monkeypatch.delenv("REDIS_URL", raising=False)
    captured: dict = {}

    def fake_from_url(url: str, **kwargs) -> str:
        captured["kwargs"] = kwargs
        return url

    monkeypatch.setattr(redis_config.aioredis, "from_url", fake_from_url)

    redis_config.build_redis_client(decode_responses=False, max_connections=25)
    assert captured["kwargs"]["decode_responses"] is False
    assert captured["kwargs"]["max_connections"] == 25
    # defaults still present alongside the overrides
    assert captured["kwargs"]["socket_timeout"] == 2
