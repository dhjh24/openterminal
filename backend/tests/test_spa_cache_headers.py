"""Static SPA cache-control headers for deploy-safe asset serving."""

from __future__ import annotations

from pathlib import Path

from backend.main import _cache_headers_for_path


def test_html_entrypoints_are_no_cache() -> None:
    assert _cache_headers_for_path("index.html") == {"Cache-Control": "no-cache"}
    assert _cache_headers_for_path("app.html") == {"Cache-Control": "no-cache"}
    assert _cache_headers_for_path("home/index.html") == {"Cache-Control": "no-cache"}


def test_hashed_assets_are_immutable() -> None:
    assert _cache_headers_for_path("assets/HeatmapPage-C0tQN-l4.js") == {
        "Cache-Control": "public, max-age=31536000, immutable"
    }
    assert _cache_headers_for_path("assets/vendor-charts-a1b2c3d4.js") == {
        "Cache-Control": "public, max-age=31536000, immutable"
    }


def test_sw_and_manifest_are_no_cache() -> None:
    assert _cache_headers_for_path("sw.js") == {"Cache-Control": "no-cache"}
    assert _cache_headers_for_path("manifest.json") == {"Cache-Control": "no-cache"}


def test_unhashed_static_has_no_special_policy() -> None:
    assert _cache_headers_for_path("favicon.png") == {}
    assert _cache_headers_for_path("icons/icon-192.png") == {}


def test_assets_prefix_even_without_hash() -> None:
    # Prefer immutable for anything under /assets/ so SPA fallbacks are not sticky.
    headers = _cache_headers_for_path("assets/index.js")
    assert headers.get("Cache-Control", "").startswith("public")
