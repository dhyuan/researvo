import type { ReactNode } from "react";

import { SidebarNav } from "@/components/app/SidebarNav";

const agentSignals = [
  "Human workspace",
  "Agent operable",
  "Research output",
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--hs-page)] text-[var(--hs-text)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-[var(--hs-surface)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--hs-primary-deep)] focus:shadow-lg"
        href="#main-content"
      >
        Skip to content
      </a>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1400px]">
        <aside className="hidden w-60 shrink-0 border-r border-[var(--hs-border)] bg-[var(--hs-surface)]/86 px-4 py-5 md:block">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--hs-primary)] text-sm font-semibold text-white shadow-[0_16px_30px_-22px_rgba(23,70,63,0.9)]">
                R
              </div>
              <div>
                <div className="text-base font-semibold tracking-tight text-[var(--hs-text)]">Researvo</div>
                <div className="text-xs font-medium text-[var(--hs-muted)]">Research workbench</div>
              </div>
            </div>
          </div>
          <SidebarNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--hs-border)] bg-[var(--hs-page)]/92 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 md:hidden">
                <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--hs-primary)] text-sm font-semibold text-white">
                  R
                </div>
                <div>
                  <div className="text-base font-semibold tracking-tight text-[var(--hs-text)]">Researvo</div>
                  <div className="text-xs font-medium text-[var(--hs-muted)]">Research workbench</div>
                </div>
              </div>
              <div className="hidden min-w-0 flex-1 items-center justify-between gap-5 md:flex">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-8 rounded-full bg-[var(--hs-primary)]" aria-hidden="true" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--hs-primary-deep)]">
                      Agent-native survey operations
                    </p>
                  </div>
                  <p className="mt-1 max-w-[56ch] text-sm leading-5 text-[var(--hs-muted)]">
                    Available not only for humans, but also for AI agents.
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 lg:flex" aria-label="Agent-ready product signals">
                  {agentSignals.map((signal) => {
                    return (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-transparent px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--hs-muted)]"
                        key={signal}
                      >
                        <span className="size-1.5 rounded-full bg-[var(--hs-primary)]/55" aria-hidden="true" />
                        {signal}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="md:hidden">
                <SidebarNav orientation="horizontal" />
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
