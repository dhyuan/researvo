import type { ReactNode } from "react";
import { Mail } from "lucide-react";

import { SidebarNav } from "@/components/app/SidebarNav";

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
                <div className="hidden shrink-0 items-center gap-2 lg:flex" aria-label="Feedback and contact">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--hs-muted)]">
                    Feed back & Contact us:
                  </span>
                  <a
                    aria-label="Email feedback and contact"
                    className="inline-flex size-8 items-center justify-center rounded-full text-[var(--hs-muted)] transition-colors duration-200 hover:bg-[var(--hs-primary-soft)] hover:text-[var(--hs-primary-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hs-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hs-page)]"
                    href="mailto:dhyuan@gmail.com"
                  >
                    <Mail aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  </a>
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
