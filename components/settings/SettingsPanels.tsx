import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function SettingsPanels() {
  return (
    <div className="grid max-w-4xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">Manage workspace preferences and account security.</p>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">AI providers</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">
              Provider keys and model routing will be configurable here in a later release.
            </p>
          </div>
          <StatusBadge tone="neutral">Coming later</StatusBadge>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Security</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">
              Authentication is managed through your connected identity provider.
            </p>
          </div>
          <Button disabled variant="secondary">
            Manage sessions
          </Button>
        </div>
      </Panel>
    </div>
  );
}
