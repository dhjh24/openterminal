import type { ReactNode } from "react";

import { formatPercent, isMissingNumber } from "../../lib/format";

export type ChangeValueProps = {
  value: number | null | undefined;
  decimals?: number;
  showArrow?: boolean;
  className?: string;
};

function changeTone(value: number): "up" | "down" | "neutral" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}

function toneClass(tone: "up" | "down" | "neutral"): string {
  if (tone === "up") return "text-terminal-pos";
  if (tone === "down") return "text-terminal-neg";
  return "text-terminal-muted";
}

function directionAria(tone: "up" | "down" | "neutral"): string {
  if (tone === "up") return "increase";
  if (tone === "down") return "decrease";
  return "unchanged";
}

export function ChangeValue({
  value,
  decimals = 2,
  showArrow = true,
  className = "",
}: ChangeValueProps): ReactNode {
  const tone = isMissingNumber(value) ? "neutral" : changeTone(value as number);
  const display = formatPercent(value as number, { signed: true, decimals });
  const arrow = showArrow && !isMissingNumber(value) ? (tone === "up" ? "▲ " : tone === "down" ? "▼ " : "") : "";

  return (
    <span
      className={`ot-type-data tabular-nums ${toneClass(tone)} ${className}`.trim()}
      aria-label={`${directionAria(tone)}: ${display}`}
    >
      {arrow}
      {display}
    </span>
  );
}
