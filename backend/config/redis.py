from __future__ import annotations

import os
from typing import Any

from redis import asyncio as aioredis


def build_redis_client(redis_url: str | None = None, **kwargs: Any) -> Any:
    url = redis_url or os.getenv("REDIS_URL") or "redis://localhost:6379/0"
    return aioredis.from_url(
        url,
        socket_connect_timeout=2,
        socket_timeout=2,
        socket_keepalive=True,
        retry_on_timeout=True,
        health_check_interval=10,
        **kwargs,
    )
