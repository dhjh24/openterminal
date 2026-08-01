import { GuidedEmptyState } from "../dashboard/GuidedEmptyState";
import type { ActionQueueItem } from "../../home/actionQueue";

type Props = {
  items: ActionQueueItem[];
  onSelect: (item: ActionQueueItem) => void;
  onExplore?: () => void;
};

const SEVERITY_CLASS: Record<ActionQueueItem["severity"], string> = {
  critical: "border-rose-500/60 text-rose-300",
  warning: "border-amber-500/60 text-amber-200",
  info: "border-terminal-border text-terminal-muted",
};

export function ActionQueueSection({ items, onSelect, onExplore }: Props) {
  return (
    <section
      className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
      aria-label="Action queue"
      data-testid="action-queue"
    >
      <div className="mb-3">
        <h2 className="ot-type-panel-title ot-home-title-mobile uppercase tracking-[0.14em] text-terminal-accent">
          Action queue
        </h2>
        <p className="mt-1 text-sm text-terminal-muted">
          Alerts, stale data, unfinished research, and provider issues that need a next step.
        </p>
      </div>

      {items.length === 0 ? (
        <GuidedEmptyState
          title="Queue clear"
          message="No open alerts, stale feeds, or unfinished desk work right now. Explore tools or open your primary action."
          icon="QUEUE"
          actions={[
            ...(onExplore
              ? [{ label: "Explore all tools", onClick: onExplore }]
              : []),
          ]}
        />
      ) : (
        <ul className="space-y-2" role="list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex flex-col gap-2 rounded-sm border bg-terminal-bg/40 p-2.5 sm:flex-row sm:items-center sm:justify-between ${SEVERITY_CLASS[item.severity]}`}
              data-testid={`action-queue-item-${item.id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-terminal-text">{item.title}</p>
                <p className="mt-0.5 text-xs text-terminal-muted">{item.description}</p>
              </div>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-sm border border-terminal-border px-3 text-[11px] uppercase tracking-[0.12em] text-terminal-text hover:border-terminal-accent hover:text-terminal-accent"
                onClick={() => onSelect(item)}
              >
                {item.actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
