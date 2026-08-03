"""Issue #27 — paper options cash/P&L use the 100-share contract multiplier."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from backend.models import VirtualOrderStatus
from backend.paper_trading.service import (
    OPTION_CONTRACT_MULTIPLIER,
    PaperTradingEngine,
    contract_multiplier,
    looks_like_option_symbol,
)


def test_looks_like_option_symbol_occ_and_synthetic() -> None:
    assert looks_like_option_symbol("NASDAQ:AAPL250815C00150000")
    assert looks_like_option_symbol("AAPL250815P00150000")
    assert looks_like_option_symbol("NASDAQ:AAPL-2025-08-15-C-150")
    assert not looks_like_option_symbol("NASDAQ:AAPL")
    assert not looks_like_option_symbol("AAPL")


def test_contract_multiplier_is_100_for_options() -> None:
    assert contract_multiplier("NASDAQ:AAPL250815C00150000") == OPTION_CONTRACT_MULTIPLIER
    assert contract_multiplier("NASDAQ:AAPL") == 1.0


def test_fill_buy_option_debits_cash_with_multiplier() -> None:
    engine = PaperTradingEngine()
    portfolio = SimpleNamespace(id="pf-1", current_cash=100_000.0)
    order = SimpleNamespace(
        id="ord-1",
        portfolio_id="pf-1",
        symbol="NASDAQ:AAPL250815C00150000",
        side="buy",
        quantity=2.0,
        slippage_bps=0.0,
        commission=0.0,
        fill_price=None,
        fill_time=None,
        status=VirtualOrderStatus.PENDING.value,
    )

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [
        portfolio,  # portfolio lookup in _fill_order
        None,  # existing position in _update_position
    ]

    engine._fill_order(db, order, 3.3)

    # 2 contracts × $3.30 × 100 = $660 (+ 0.05% commission on notional)
    expected_notional = 2.0 * 3.3 * 100.0
    expected_commission = expected_notional * 0.0005
    assert order.status == VirtualOrderStatus.FILLED.value
    assert order.fill_price == 3.3
    assert portfolio.current_cash == 100_000.0 - expected_notional - expected_commission
    assert db.add.call_count >= 2  # VirtualPosition + VirtualTrade
