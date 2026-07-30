from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent

FORBIDDEN_IMPORT_ROOTS = ("kiteconnect", "nsepython", "nsetools")
FORBIDDEN_MODULE_SUFFIXES = (
    "backend.adapters.kite",
    "backend.core.kite_client",
    "backend.core.nse_client",
    "backend.services.kite_stream",
    "backend.shared.nse_session",
)

# Patterns that must not appear in production backend code (tests/docs allowlisted).
FORBIDDEN_CONTENT_PATTERNS = [
    (re.compile(r"\bNIFTY_50\b"), "NIFTY_50 constant"),
    (re.compile(r"Asia/Kolkata"), "Asia/Kolkata timezone"),
    (re.compile(r"IST\s*=\s*UTC"), "IST=UTC offset"),
    (re.compile(r"timedelta\(hours=5,\s*minutes=30\)"), "fixed IST offset"),
    (re.compile(r"MARKET_START\s*=\s*\(9,\s*15\)"), "NSE market start"),
]

# Paths relative to backend/ that may retain historical migration text.
CONTENT_ALLOWLIST = {
    "alembic/versions/0012_drop_nse_fno_bhavcopy.py",
    "tests/test_no_india_imports.py",
    "tests/test_api_unsupported_market.py",
    "tests/test_prefetch_us_schedule.py",
    "tests/test_market_profile_us.py",
}


def _iter_production_py_files() -> list[Path]:
    files: list[Path] = []
    for path in BACKEND_ROOT.rglob("*.py"):
        rel = path.relative_to(BACKEND_ROOT)
        parts = rel.parts
        if "tests" in parts or parts[0] == "tests":
            continue
        if "__pycache__" in parts:
            continue
        files.append(path)
    return files


def _import_violations(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError:
        return [f"{path}: syntax error"]

    violations: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = (alias.name or "").split(".", 1)[0]
                if root in FORBIDDEN_IMPORT_ROOTS or alias.name in FORBIDDEN_MODULE_SUFFIXES:
                    violations.append(f"{path}: import {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            root = module.split(".", 1)[0]
            if root in FORBIDDEN_IMPORT_ROOTS or module in FORBIDDEN_MODULE_SUFFIXES:
                violations.append(f"{path}: from {module} import ...")
    return violations


@pytest.fixture(autouse=True)
def _us_profile_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKET_PROFILE", "US")


def test_production_code_has_no_india_provider_imports() -> None:
    violations: list[str] = []
    for path in _iter_production_py_files():
        violations.extend(_import_violations(path))
    assert not violations, "India-only imports found:\n" + "\n".join(sorted(violations))


def test_production_code_has_no_india_market_scheduling() -> None:
    violations: list[str] = []
    for path in _iter_production_py_files():
        rel = str(path.relative_to(BACKEND_ROOT)).replace("\\", "/")
        if rel in CONTENT_ALLOWLIST:
            continue
        text = path.read_text(encoding="utf-8")
        for pattern, label in FORBIDDEN_CONTENT_PATTERNS:
            if pattern.search(text):
                violations.append(f"{rel}: {label}")
    assert not violations, "India-market remnants found:\n" + "\n".join(sorted(violations))


def test_marketdata_hub_does_not_start_kite_stream() -> None:
    from backend.services.marketdata_hub import MarketDataHub

    hub = MarketDataHub()
    assert hub.kite_stream_status() == "disabled"


def test_main_module_does_not_start_india_workers() -> None:
    source = (BACKEND_ROOT / "main.py").read_text(encoding="utf-8")
    assert "instruments_loader" not in source
    assert "get_instruments_loader" not in source
    assert "is_us_only()" not in source or "instruments_loader" not in source


def test_prefetch_worker_has_no_nifty_list() -> None:
    source = (BACKEND_ROOT / "services" / "prefetch_worker.py").read_text(encoding="utf-8")
    assert "NIFTY_50" not in source
    assert "RELIANCE" not in source
    assert "America/New_York" in source or "equity_market_open_now" in source
