import { useNavigate } from "react-router-dom";

import { getHubLandingConfig, type HubLandingConfig } from "../../home/hubLandings";
import type { DesktopHubId } from "../../home/mobileNav";

type Props = {
  hubId: Exclude<DesktopHubId, "home">;
};

export function HubLandingPage({ hubId }: Props) {
  const navigate = useNavigate();
  const config = getHubLandingConfig(hubId);

  return <HubLandingView config={config} onNavigate={(to) => navigate(to)} />;
}

export function HubLandingView({
  config,
  onNavigate,
}: {
  config: HubLandingConfig;
  onNavigate: (to: string) => void;
}) {
  return (
    <div className="flex min-h-full flex-col gap-3 p-3 md:p-4" data-testid={`hub-landing-${config.id}`}>
      <header
        className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
        aria-label={`${config.title} hub header`}
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-terminal-accent">{config.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-terminal-text md:text-3xl">{config.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-terminal-muted">{config.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-sm border border-terminal-accent px-4 text-[11px] uppercase tracking-[0.12em] text-terminal-accent hover:bg-terminal-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
            data-testid={`hub-primary-${config.id}`}
            onClick={() => onNavigate(config.primary.to)}
          >
            {config.primary.label}
          </button>
          {config.secondary ? (
            <button
              type="button"
              className="min-h-11 rounded-sm border border-terminal-border px-4 text-[11px] uppercase tracking-[0.12em] text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
              data-testid={`hub-secondary-${config.id}`}
              onClick={() => onNavigate(config.secondary!.to)}
            >
              {config.secondary.label}
            </button>
          ) : null}
        </div>
      </header>

      {config.sections.map((section) => (
        <section
          key={section.title}
          className="rounded-sm border border-terminal-border bg-terminal-panel/80 p-3"
          aria-label={section.title}
        >
          <h2 className="ot-type-panel-title uppercase tracking-[0.14em] text-terminal-accent">{section.title}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {section.tools.map((tool) => (
              <li key={tool.to + tool.label}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-col items-start justify-center rounded-md border border-terminal-border bg-terminal-bg/40 px-3 py-2 text-left hover:border-terminal-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
                  onClick={() => onNavigate(tool.to)}
                  aria-label={`${tool.label}. ${tool.description}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-medium text-terminal-text">{tool.label}</span>
                    <abbr
                      className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted no-underline"
                      title={`${tool.badge} shortcut for ${tool.label}`}
                    >
                      {tool.badge}
                    </abbr>
                  </span>
                  <span className="mt-0.5 text-xs text-terminal-muted">{tool.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function MarketsHubPage() {
  return <HubLandingPage hubId="markets" />;
}

export function TradeHubPage() {
  return <HubLandingPage hubId="trade" />;
}

export function ResearchHubPage() {
  return <HubLandingPage hubId="research" />;
}

export function PortfolioHubPage() {
  return <HubLandingPage hubId="portfolio" />;
}
