export type ActionQueueSeverity = "info" | "warning" | "critical";

export type ActionQueueItem = {
  id: string;
  title: string;
  description: string;
  severity: ActionQueueSeverity;
  actionLabel: string;
  to: string;
};

export type ActionQueueInput = {
  alertCount: number;
  marketQuotesReady: boolean;
  snapshotAgeMs: number | null;
  newsCount: number;
  backtestPresetCount: number;
  paperPositionCount: number;
  holdingsCount: number;
  providerIssues: boolean;
};

const STALE_SNAPSHOT_MS = 5 * 60 * 1000;

export function buildActionQueue(input: ActionQueueInput): ActionQueueItem[] {
  const items: ActionQueueItem[] = [];

  if (input.providerIssues) {
    items.push({
      id: "provider-issues",
      title: "Provider health needs attention",
      description: "A market-data or derivatives feed looks unavailable. Check Data Quality and Ops.",
      severity: "critical",
      actionLabel: "Open Data Quality",
      to: "/equity/data-quality",
    });
  }

  if (!input.marketQuotesReady) {
    items.push({
      id: "stale-quotes",
      title: "Market quotes are missing",
      description: "Index pulse has no live prices yet. Confirm relay and provider status.",
      severity: "warning",
      actionLabel: "Open Ops",
      to: "/equity/ops",
    });
  } else if (input.snapshotAgeMs != null && input.snapshotAgeMs > STALE_SNAPSHOT_MS) {
    items.push({
      id: "stale-snapshot",
      title: "Home snapshot is stale",
      description: "Portfolio and desk telemetry have not refreshed recently.",
      severity: "warning",
      actionLabel: "Open Ops",
      to: "/equity/ops",
    });
  }

  if (input.alertCount > 0) {
    items.push({
      id: "open-alerts",
      title: `${input.alertCount} open alert${input.alertCount === 1 ? "" : "s"}`,
      description: "Review triggered or armed alerts before the next session move.",
      severity: "warning",
      actionLabel: "Open Alerts",
      to: "/equity/alerts",
    });
  }

  if (input.backtestPresetCount > 0) {
    items.push({
      id: "unfinished-backtest",
      title: "Continue research work",
      description: `${input.backtestPresetCount} saved backtest preset${input.backtestPresetCount === 1 ? "" : "s"} ready to reopen.`,
      severity: "info",
      actionLabel: "Open Backtesting",
      to: "/backtesting",
    });
  }

  if (input.paperPositionCount > 0) {
    items.push({
      id: "paper-positions",
      title: `${input.paperPositionCount} paper position${input.paperPositionCount === 1 ? "" : "s"} open`,
      description: "Review paper P/L and risk before sizing live ideas.",
      severity: "info",
      actionLabel: "Open Paper",
      to: "/equity/paper",
    });
  }

  if (input.holdingsCount === 0) {
    items.push({
      id: "empty-portfolio",
      title: "Add your first holding",
      description: "Portfolio snapshot stays empty until holdings are imported or entered.",
      severity: "info",
      actionLabel: "Open Portfolio",
      to: "/equity/portfolio",
    });
  }

  if (input.newsCount === 0) {
    items.push({
      id: "empty-news",
      title: "No headlines on the wire",
      description: "Start news polling or open the Intel desk for session context.",
      severity: "info",
      actionLabel: "Open News",
      to: "/equity/news",
    });
  }

  return items.slice(0, 6);
}
