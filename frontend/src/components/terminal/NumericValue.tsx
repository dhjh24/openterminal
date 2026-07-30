import type { ReactNode } from "react";

import { formatNumber, formatPrice, formatVolume, isMissingNumber, MISSING } from "../../lib/format";

export type NumericValueTone = "neutral" | "up" | "down";

export type NumericValueProps = {
  value: number | null | undefined;
  kind?: "number" | "price" | "volume";
  decimals?: number;
  tone?: NumericValueTone;
  compact?: boolean;
  className?: string;
  title?: string;
};

function toneClass(tone: NumericValueTone): string {
  if (tone === "up") return "text-terminal-pos";
  if (tone === "down") return "text-terminal-neg";
  return "";
}

function toneAria(tone: NumericValueTone): string | undefined {
  if (tone === "up") return "positive value";
  if (tone === "down") return "negative value";
  return undefined;
}

function formatValue(
  value: number | null | undefined,
  kind: NumericValueProps["kind"],
  decimals?: number,
): string {
  if (isMissingNumber(value)) return MISSING;
  if (kind === "price") return formatPrice(value as number, { decimals });
  if (kind === "volume") return formatVolume(value as number);
  return formatNumber(value as number);
}

export function NumericValue({
  value,
  kind = "number",
  decimals,
  tone = "neutral",
  compact = false,
  className = "",
  title,
}: NumericValueProps): ReactNode {
  const display = formatValue(value, kind, decimals);
  const tooltip = title ?? (compact && !isMissingNumber(value) ? formatValue(value, kind, decimals) : undefined);

  return (
    <span
      className={`ot-type-data tabular-nums ${toneClass(tone)} ${className}`.trim()}
      title={tooltip}
      aria-label={toneAria(tone)}
    >
      {display}
    </span>
  );
}
