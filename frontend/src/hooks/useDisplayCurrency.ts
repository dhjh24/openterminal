import { useEffect, useMemo, useRef } from "react";

import { useSettingsStore } from "../store/settingsStore";
import { formatMoney } from "../lib/format";

export function useDisplayCurrency() {
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  const moneySymbol = "$";
  const moneyLocale = "en-US";
  const financialUnit = "M";
  const financialDivisor = 1e6;

  const convertAmount = (value: number): number => {
    if (!Number.isFinite(value)) return value;
    return value;
  };

  const formatDisplayMoney = (value: number): string => {
    const converted = convertAmount(value);
    return formatMoney(converted, displayCurrency);
  };

  const scaleFinancialAmount = (value: number): number => {
    const converted = convertAmount(value);
    if (!Number.isFinite(converted)) return Number.NaN;
    return converted / financialDivisor;
  };

  const formatFinancialCompact = (value: number): string => {
    const scaled = scaleFinancialAmount(value);
    if (!Number.isFinite(scaled)) return "-";
    return `${moneySymbol} ${scaled.toLocaleString(moneyLocale, { maximumFractionDigits: 2 })} ${financialUnit}`;
  };

  return {
    displayCurrency,
    usdInr: null as number | null,
    convertAmount,
    formatDisplayMoney,
    financialUnit,
    scaleFinancialAmount,
    formatFinancialCompact,
  };
}
