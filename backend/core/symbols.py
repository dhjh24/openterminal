from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Symbol:
    raw: str
    market: str
    canonical: str
    provider_symbol: str


def normalize_symbol(raw_symbol: str, market: str = "NASDAQ") -> Symbol:
    """Normalize a ticker for US providers (bare symbol, no India suffixes)."""
    raw = raw_symbol.strip().upper()
    market_norm = market.strip().upper() or "NASDAQ"
    base = raw
    if base.endswith(".NS"):
        base = base[:-3]
    if base.endswith(".BO"):
        base = base[:-3]
    if "." in base and not base.startswith("^"):
        base = base.split(".", 1)[0]
    # US Yahoo / FMP / Finnhub symbols are bare (or caret indices). Never append .NS/.BO.
    provider_symbol = base
    return Symbol(
        raw=raw,
        market=market_norm,
        canonical=base,
        provider_symbol=provider_symbol,
    )
