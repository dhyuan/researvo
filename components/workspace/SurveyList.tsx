import { ArrowRight, FileJson2, FlaskConical, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArchiveSurveyButton } from "@/components/workspace/ArchiveSurveyButton";
import { DeleteSurveyButton } from "@/components/workspace/DeleteSurveyButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WorkspaceSurvey = {
  id: string;
  title: string;
  updatedAt: Date;
  status: string;
  version: number | null;
  participantCount: number;
  archivedAt: Date | null;
};

type SurveyFilter = "all" | "published" | "archived";

const filterTabs: Array<{ href: string; label: string; value: SurveyFilter }> = [
  { href: "/workspace", label: "All", value: "all" },
  { href: "/workspace?filter=published", label: "Published", value: "published" },
  { href: "/workspace?filter=archived", label: "Archived", value: "archived" },
];

function formatUpdatedDate(updatedAt: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(updatedAt);
}

export function SurveyList({ activeFilter = "all", surveys }: { activeFilter?: SurveyFilter; surveys: WorkspaceSurvey[] }) {
  if (surveys.length === 0) {
    return (
      <Panel className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 sm:p-8">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--hs-primary-soft)] text-[var(--hs-primary-deep)]">
              <FlaskConical aria-hidden="true" className="size-5" strokeWidth={1.8} />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-[var(--hs-text)]">Start your first research instrument</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--hs-muted)]">
              Begin with a research goal, generate a structured schema prompt, then validate the survey before sharing a public link.
            </p>
            <LinkButton className="mt-6" href="/surveys/new/wizard">
              New survey
            </LinkButton>
          </div>
          <div className="border-t border-[var(--hs-border)] bg-[var(--hs-surface-muted)]/60 p-6 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              {[
                { icon: FileJson2, label: "Define stable variables" },
                { icon: ShieldCheck, label: "Validate schema quality" },
                { icon: ArrowRight, label: "Publish an analysis-ready URL" },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div className="flex items-center gap-3" key={item.label}>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white text-[var(--hs-primary)] ring-1 ring-[var(--hs-border)]">
                      <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                    </div>
                    <p className="text-sm font-medium text-[var(--hs-text)]">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-[var(--hs-border)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--hs-text)]">Survey library</h2>
            <p className="mt-1 text-sm text-[var(--hs-muted)]">Stable schemas, publication state, and public collection links.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map((tab) => (
              <Link
                className={[
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  activeFilter === tab.value
                    ? "border-[var(--hs-primary)] bg-[var(--hs-primary-soft)] text-[var(--hs-primary-deep)]"
                    : "border-[var(--hs-border)] bg-[var(--hs-surface)] text-[var(--hs-muted)] hover:text-[var(--hs-primary-deep)]",
                ].join(" ")}
                href={tab.href}
                key={tab.value}
              >
                {tab.label}
              </Link>
            ))}
            <p className="ml-1 font-mono text-xs text-[var(--hs-muted)] tabular-nums">{surveys.length} total</p>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 text-xs uppercase tracking-[0.08em] text-[var(--hs-muted)]">Instrument</TableHead>
              <TableHead className="text-xs uppercase tracking-[0.08em] text-[var(--hs-muted)]">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-[0.08em] text-[var(--hs-muted)]">Version</TableHead>
              <TableHead className="text-xs uppercase tracking-[0.08em] text-[var(--hs-muted)]">Participants</TableHead>
              <TableHead className="text-xs uppercase tracking-[0.08em] text-[var(--hs-muted)]">Updated</TableHead>
              <TableHead className="px-5 text-right text-xs uppercase tracking-[0.08em] text-[var(--hs-muted)]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow key={survey.id}>
                <TableCell className="max-w-[320px] px-5">
                  <Link
                    className="font-medium text-[var(--hs-text)] underline-offset-4 hover:text-[var(--hs-primary-deep)] hover:underline"
                    href={`/surveys/${survey.id}`}
                  >
                    {survey.title}
                  </Link>
                  <p className="mt-1 truncate font-mono text-xs text-[var(--hs-muted)]">{survey.id}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={survey.status === "published" ? "published" : "draft"}>
                    {survey.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="font-mono text-sm text-[var(--hs-text)] tabular-nums">
                  {survey.version ? `v${survey.version}` : "draft"}
                </TableCell>
                <TableCell className="font-mono text-sm text-[var(--hs-text)] tabular-nums">
                  {survey.participantCount}
                </TableCell>
                <TableCell className="font-mono text-sm text-[var(--hs-muted)] tabular-nums">
                  {formatUpdatedDate(survey.updatedAt)}
                </TableCell>
                <TableCell className="px-5 text-right">
                  <div className="flex justify-end gap-2">
                    <LinkButton aria-label={`Edit ${survey.title}`} href={`/surveys/${survey.id}`} size="sm" variant="secondary">
                      Edit
                    </LinkButton>
                    {!survey.archivedAt ? <ArchiveSurveyButton surveyId={survey.id} surveyTitle={survey.title} /> : null}
                    <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-[var(--hs-border)] md:hidden">
        {surveys.map((survey) => (
          <div
            className="grid gap-4 p-4"
            key={survey.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link className="font-medium text-[var(--hs-text)] hover:text-[var(--hs-primary-deep)]" href={`/surveys/${survey.id}`}>
                  {survey.title}
                </Link>
                <StatusBadge tone={survey.status === "published" ? "published" : "draft"}>
                  {survey.status}
                </StatusBadge>
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--hs-muted)]">Updated</dt>
                  <dd className="font-mono text-[var(--hs-text)] tabular-nums">{formatUpdatedDate(survey.updatedAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--hs-muted)]">Version</dt>
                  <dd className="font-mono text-[var(--hs-text)] tabular-nums">{survey.version ? `v${survey.version}` : "draft"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--hs-muted)]">Participants</dt>
                  <dd className="font-mono text-[var(--hs-text)] tabular-nums">{survey.participantCount}</dd>
                </div>
              </dl>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <LinkButton aria-label={`Edit ${survey.title}`} className="w-full" href={`/surveys/${survey.id}`} variant="secondary">
                Edit
              </LinkButton>
              {!survey.archivedAt ? <ArchiveSurveyButton surveyId={survey.id} surveyTitle={survey.title} /> : null}
              <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
