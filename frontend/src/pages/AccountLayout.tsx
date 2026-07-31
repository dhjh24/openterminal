import { Outlet } from "react-router-dom";

import { TerminalShell } from "../components/layout/TerminalShell";

export function AccountLayout() {
  return (
    <TerminalShell
      hideTickerLoader
      statusBarTickerOverride="ACCOUNT"
      showInstallPrompt
      showMobileBottomNav
      workspacePresetStorageKey="ot:shell:account:preset"
    >
      <Outlet />
    </TerminalShell>
  );
}
