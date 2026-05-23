"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Eye, FileCode2, GitBranch, Send, ShieldCheck } from "lucide-react";

import { ExportButtons } from "@/components/export/ExportButtons";
import { SurveyMetricsPanel } from "@/components/metrics/SurveyMetricsPanel";
import { SchemaEditor } from "@/components/survey/SchemaEditor";
import { SurveyFlowEditor } from "@/components/survey/SurveyFlowEditor";
import { SurveyPreview } from "@/components/survey/SurveyPreview";
import { Button, LinkButton } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ValidationReportPanel } from "@/components/validation/ValidationReportPanel";
import { SurveySchemaZ, type SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";

type SurveyMaintenanceClientProps = {
  surveyId: string;
};

type Metrics = {
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageCompletionSeconds: number | null;
};

const parseSchemaText = (schemaText: string): { schema: unknown; error: null } | { schema: null; error: string } => {
  try {
    return { schema: JSON.parse(schemaText) as unknown, error: null };
  } catch (error) {
    return { schema: null, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
};

const schemaWithoutFlowLayout = (schema: SurveySchema): SurveySchema => {
  const metadata = { ...schema.metadata };
  delete metadata.flowLayout;

  return { ...schema, metadata };
};

const schemaSnapshot = (schema: unknown) => {
  const schemaResult = SurveySchemaZ.safeParse(schema);

  return schemaResult.success ? JSON.stringify(schemaWithoutFlowLayout(schemaResult.data)) : null;
};

export function SurveyMaintenanceClient({ surveyId }: SurveyMaintenanceClientProps) {
  const [schemaText, setSchemaText] = useState("");
  const parsedSchema = useMemo(() => (schemaText.trim() ? parseSchemaText(schemaText) : { schema: null, error: null }), [schemaText]);
  const [validationReport, setValidationReport] = useState<{ schemaText: string; report: ValidationReport | null } | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("flow");
  const [lastPublishedSchemaText, setLastPublishedSchemaText] = useState<string | null>(null);
  const currentValidationReport = validationReport?.schemaText === schemaText ? validationReport.report : null;
  const parsedSchemaResult = useMemo(() => SurveySchemaZ.safeParse(parsedSchema.schema), [parsedSchema.schema]);
  const surveyTitle = parsedSchemaResult.success ? parsedSchemaResult.data.survey.title : surveyId;
  const currentSchemaSnapshot = parsedSchemaResult.success ? JSON.stringify(schemaWithoutFlowLayout(parsedSchemaResult.data)) : null;
  const publishHasChanges = !lastPublishedSchemaText || currentSchemaSnapshot !== lastPublishedSchemaText;

  const hasBlockingErrors = useMemo(
    () => currentValidationReport?.findings.some((finding) => finding.level === "error") ?? false,
    [currentValidationReport],
  );
  const validationCounts = useMemo(() => {
    const findings = currentValidationReport?.findings ?? [];

    return {
      errors: findings.filter((finding) => finding.level === "error").length,
      warnings: findings.filter((finding) => finding.level === "warning").length,
      suggestions: findings.filter((finding) => finding.level === "suggestion").length,
    };
  }, [currentValidationReport]);
  const statusLabel = parsedSchema.error
    ? "Parse blocked"
    : currentValidationReport
      ? hasBlockingErrors
        ? "Validation blocked"
        : "Validation ready"
      : "Validation pending";
  const isPublishDisabled = Boolean(parsedSchema.error) || hasBlockingErrors || !publishHasChanges;

  useEffect(() => {
    const loadDraft = async () => {
      const response = await fetch(`/api/surveys/${surveyId}/draft`);
      const payload = (await response.json()) as { draft?: { schema: unknown }; latestVersion?: { publicId?: string; schema: unknown } | null };

      if (payload.draft) {
        setSchemaText(JSON.stringify(payload.draft.schema, null, 2));
      }

      setLastPublishedSchemaText(schemaSnapshot(payload.latestVersion?.schema));
      setPublicUrl(payload.latestVersion?.publicId ? `/public/s/${payload.latestVersion.publicId}` : null);
    };

    void loadDraft();
  }, [surveyId]);

  useEffect(() => {
    if (!parsedSchema.schema) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/surveys/${surveyId}/validate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ schema: parsedSchema.schema }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as { validationReport?: ValidationReport };

        if (!controller.signal.aborted) {
          setValidationReport({ schemaText, report: payload.validationReport ?? null });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setValidationReport({ schemaText, report: null });
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [parsedSchema.schema, schemaText, surveyId]);

  const parseCurrentSchema = () => {
    const parsed = parseSchemaText(schemaText);

    return parsed.schema;
  };

  const saveSchemaDraft = async (schema: unknown, successMessage = "Draft saved.") => {
    if (!schema) {
      return false;
    }

    const response = await fetch(`/api/surveys/${surveyId}/draft`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schema }),
    });

    setMessage(response.ok ? successMessage : "Unable to save draft.");
    return response.ok;
  };

  const saveDraft = async () => saveSchemaDraft(parseCurrentSchema());

  const validateDraft = async () => {
    const schema = parseCurrentSchema();

    if (!schema) {
      return;
    }

    const response = await fetch(`/api/surveys/${surveyId}/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schema }),
    });
    const payload = (await response.json()) as { validationReport?: ValidationReport };

    setValidationReport({ schemaText, report: payload.validationReport ?? null });
  };

  const publish = async () => {
    const saved = await saveDraft();

    if (!saved) {
      return;
    }

    const response = await fetch(`/api/surveys/${surveyId}/publish`, { method: "POST" });
    const payload = (await response.json()) as { publicUrl?: string; validationReport?: ValidationReport };

    if (payload.validationReport) {
      setValidationReport({ schemaText, report: payload.validationReport });
    }

    setPublicUrl(payload.publicUrl ?? null);
    setMessage(response.ok ? "Published." : "Publish blocked.");

    if (response.ok && currentSchemaSnapshot) {
      setLastPublishedSchemaText(currentSchemaSnapshot);
    }
  };

  const refreshMetrics = useCallback(async () => {
    const response = await fetch(`/api/surveys/${surveyId}/metrics`);
    const payload = (await response.json()) as { metrics?: Metrics };

    setMetrics(payload.metrics ?? null);
  }, [surveyId]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);

    if (value === "metrics") {
      void refreshMetrics();
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--hs-text)]">{surveyTitle}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-md border border-[var(--hs-border)] bg-[var(--hs-surface)] px-2 py-1 text-[var(--hs-muted)]">{statusLabel}</span>
            <span className="rounded-md border border-[var(--hs-border)] bg-[var(--hs-surface)] px-2 py-1 text-[var(--hs-error)]">{validationCounts.errors} errors</span>
            <span className="rounded-md border border-[var(--hs-border)] bg-[var(--hs-surface)] px-2 py-1 text-[var(--hs-warning)]">{validationCounts.warnings} warnings</span>
            <span className="rounded-md border border-[var(--hs-border)] bg-[var(--hs-surface)] px-2 py-1 text-[var(--hs-muted)]">
              {validationCounts.suggestions} suggestions
            </span>
          </div>
        </div>
        <Button onClick={publish} disabled={isPublishDisabled}>
          <Send />
          Publish
        </Button>
      </div>

      {message ? <p className="mt-4 text-sm text-[var(--hs-muted)]">{message}</p> : null}
      {publicUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--hs-border)] bg-[var(--hs-surface)] px-3 py-2">
          <a className="min-w-0 flex-1 break-all text-sm font-medium text-[var(--hs-primary)] hover:text-[var(--hs-primary-deep)]" href={publicUrl}>
            {publicUrl}
          </a>
          <CopyButton label="Copy URL" text={publicUrl} />
          <LinkButton href={publicUrl} rel="noreferrer" target="_blank" variant="secondary">
            Open
          </LinkButton>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hs-border)] pb-3">
          <TabsList variant="line" className="min-h-10 flex-wrap justify-start">
            <TabsTrigger value="schema" className="px-3">
              <FileCode2 />
              Schema + Validation
            </TabsTrigger>
            <TabsTrigger value="flow" className="px-3">
              <GitBranch />
              Flow
            </TabsTrigger>
            <TabsTrigger value="preview" className="px-3">
              <Eye />
              Preview
            </TabsTrigger>
            <TabsTrigger value="metrics" className="px-3">
              <BarChart3 />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="exports" className="px-3">
              <Download />
              Exports
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--hs-muted)]">
            <ShieldCheck className="size-4" />
            Draft changes update all tabs live
          </div>
        </div>

        <TabsContent value="schema" className="mt-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel className="p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--hs-text)]">Schema editor</h2>
                <p className="mt-1 text-sm text-[var(--hs-muted)]">Edit the canonical JSON schema. Save and validation both use this text.</p>
              </div>
              <SchemaEditor value={schemaText} parseError={parsedSchema.error} onChange={setSchemaText} onSave={saveDraft} onValidate={validateDraft} />
            </Panel>

            <Panel className="p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--hs-text)]">Validation report</h2>
                <p className="mt-1 text-sm text-[var(--hs-muted)]">Parsing errors and schema findings stay beside the editor.</p>
              </div>
              <ValidationReportPanel report={currentValidationReport} />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="flow" className="mt-5">
          <SurveyFlowEditor
            schemaText={schemaText}
            validationReport={currentValidationReport}
            onChange={setSchemaText}
            onLayoutChange={async (schema: SurveySchema) => {
              await saveSchemaDraft(schema, "Flow layout saved.");
            }}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-5">
          <Panel className="mx-auto max-w-3xl p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--hs-text)]">Respondent preview</h2>
              <p className="mt-1 text-sm text-[var(--hs-muted)]">This uses the publishing runtime locally, so responses are not recorded.</p>
            </div>
            <SurveyPreview schemaText={schemaText} />
          </Panel>
        </TabsContent>

        <TabsContent value="metrics" className="mt-5">
          <Panel className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="size-4 text-[var(--hs-muted)]" />
              <h2 className="text-lg font-semibold tracking-tight text-[var(--hs-text)]">Metrics</h2>
            </div>
            <SurveyMetricsPanel metrics={metrics} onRefresh={refreshMetrics} />
          </Panel>
        </TabsContent>

        <TabsContent value="exports" className="mt-5">
          <Panel className="p-5">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-[var(--hs-text)]">Exports</h2>
            <ExportButtons surveyId={surveyId} />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
