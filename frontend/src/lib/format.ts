type CurrencyCode = "INR" | "USD";

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
};

export const MISSING = "—";

const EN_US = "en-US";

export function isMissingNumber(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value));
}

function formatNumberCore(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(EN_US, options).format(value);
}

export function formatMoney(value: number, currency: CurrencyCode): string {
  if (isMissingNumber(value)) return MISSING;
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (isMissingNumber(value)) return MISSING;
  return formatNumberCore(value, { maximumFractionDigits: 2 });
}

export function formatCurrency(value: number, currency: CurrencyCode = "USD"): string {
  return formatMoney(value, currency);
}

export type FormatPercentOptions = {
  signed?: boolean;
  decimals?: number;
};

export function formatPercent(value: number, options: FormatPercentOptions = {}): string {
  const { signed = true, decimals = 2 } = options;
  if (isMissingNumber(value)) return MISSING;
  const absFormatted = Math.abs(value).toFixed(decimals);
  if (!signed) return `${value.toFixed(decimals)}%`;
  if (value > 0) return `+${absFormatted}%`;
  if (value < 0) return `−${absFormatted}%`;
  return `${absFormatted}%`;
}

export type FormatPriceOptions = {
  decimals?: number;
};

export function formatPrice(value: number, options: FormatPriceOptions = {}): string {
  const { decimals = 2 } = options;
  if (isMissingNumber(value)) return MISSING;
  return formatNumberCore(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatVolume(value: number): string {
  if (isMissingNumber(value)) return MISSING;
  return formatNumberCore(Math.trunc(value), { maximumFractionDigits: 0 });
}

export function formatCompactNumber(value: number): string {
  if (isMissingNumber(value)) return MISSING;
  return new Intl.NumberFormat(EN_US, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSignedNumber(
  value: number,
  options?: { decimals?: number; prefix?: string; suffix?: string },
): string {
  const { decimals = 2, prefix = "", suffix = "" } = options ?? {};
  if (isMissingNumber(value)) return MISSING;
  const formatted = formatNumberCore(Math.abs(value), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (value > 0) return `+${prefix}${formatted}${suffix}`;
  if (value < 0) return `−${prefix}${formatted}${suffix}`;
  return `${prefix}${formatted}${suffix}`;
}

export type GreekKind = "delta" | "gamma" | "theta" | "vega" | "iv";

const GREEK_PRECISION: Record<GreekKind, number> = {
  delta: 4,
  gamma: 4,
  theta: 4,
  vega: 4,
  iv: 2,
};

export function formatGreek(value: number, kind: GreekKind): string {
  if (isMissingNumber(value)) return MISSING;
  const decimals = GREEK_PRECISION[kind];
  if (kind === "iv") {
    return `${formatNumberCore(value, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}%`;
  }
  return formatNumberCore(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export type FormatTimestampOptions = {
  timeZone?: string;
};

export function formatTimestamp(date: Date | number | string, options: FormatTimestampOptions = {}): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return MISSING;
  return new Intl.DateTimeFormat(EN_US, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: options.timeZone,
  }).format(parsed);
}

export function formatMarketTime(
  date: Date | number | string,
  options: FormatTimestampOptions = {},
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return MISSING;
  const timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = new Intl.DateTimeFormat(EN_US, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).format(parsed);
  const zoneLabel =
    new Intl.DateTimeFormat(EN_US, { timeZoneName: "short", timeZone }).formatToParts(parsed).find(
      (part) => part.type === "timeZoneName",
    )?.value ?? timeZone;
  return `${time} ${zoneLabel}`;
}
