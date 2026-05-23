import { FileCheck2, FileClock, FlaskConical, RadioTower } from "lucide-react";

import { LinkButton } from "@/components/ui/Button";
import { SurveyList } from "@/components/workspace/SurveyList";
import { requirePublisher } from "@/lib/auth/currentUser";
import { getWorkspaceSurveys } from "@/lib/surveys/surveyListService";

type WorkspacePageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

const surveyFilterFromSearchParams = (filter?: string): "all" | "published" | "archived" =>
  filter === "published" || filter === "archived" ? filter : "all";

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const user = await requirePublisher();
  const params = searchParams ? await searchParams : {};
  const activeFilter = surveyFilterFromSearchParams(params.filter);
  const surveys = await getWorkspaceSurveys(user.id, activeFilter);
  const publishedCount = surveys.filter((survey) => survey.status === "published").length;
  const draftCount = surveys.length - publishedCount;
  const publicUrlCount = surveys.filter((survey) => survey.publicUrl).length;
  const updatedAt = surveys.length
    ? new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        year: "numeric",
      }).format(new Date(Math.max(...surveys.map((survey) => survey.updatedAt.getTime()))))
    : "No activity yet";

  const summaryItems = [
    { icon: FlaskConical, label: "Instruments", value: surveys.length },
    { icon: FileClock, label: "Drafts", value: draftCount },
    { icon: FileCheck2, label: "Published", value: publishedCount },
    { icon: RadioTower, label: "Public links", value: publicUrlCount },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--hs-primary)]">Workspace</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[var(--hs-text)] md:text-4xl">
            Research instruments
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--hs-muted)]">
            Build schema-first surveys, validate research structure, publish stable links, and keep exports ready for analysis.
          </p>
        </div>
        <LinkButton className="w-full sm:w-auto" href="/surveys/new/wizard">
          New survey
        </LinkButton>
      </div>

      <section
        aria-label="Workspace summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              className="rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] px-4 py-4 shadow-[0_18px_44px_-34px_rgba(38,54,47,0.35)]"
              key={item.label}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-[var(--hs-muted)]">{item.label}</p>
                <Icon aria-hidden="true" className="size-4 text-[var(--hs-primary)]" strokeWidth={1.8} />
              </div>
              <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-[var(--hs-text)] tabular-nums">
                {item.value}
              </p>
            </div>
          );
        })}
      </section>

      <div className="rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-[var(--hs-text)]">Latest workspace activity</p>
          <p className="font-mono text-xs text-[var(--hs-muted)] tabular-nums">{updatedAt}</p>
        </div>
      </div>

      <SurveyList activeFilter={activeFilter} surveys={surveys} />
    </div>
  );
}
