"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stepper } from "@/components/ui/Stepper";
import { DescribeStep, type DescribeValue } from "@/components/wizard/DescribeStep";
import { ImportStep } from "@/components/wizard/ImportStep";
import { PromptStep } from "@/components/wizard/PromptStep";
import { PublishStep } from "@/components/wizard/PublishStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { formatSurveySchemaError } from "@/lib/schema/schemaParseFeedback";
import { SurveySchemaZ, type SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";
import { buildExternalSchemaPrompt } from "@/lib/wizard/promptTemplate";

export type SerializableCreationDraft = {
  constraints: string | null;
  createdSurveyId: string | null;
  description: string | null;
  id: string;
  questionDescription: string | null;
  publicUrl: string | null;
  researchGoal: string | null;
  schema: unknown;
  title: string | null;
};

type StepId = "describe" | "prompt" | "import" | "review" | "publish";

type ValidateResponse = {
  validationReport?: ValidationReport;
};

type FinalizeResponse = {
  surveyId?: string;
};

type PublishResponse = {
  publicUrl?: string;
  validationReport?: ValidationReport;
};

type SaveCreationDraftResponse = {
  draft?: {
    createdSurveyId: string | null;
  };
};

const steps: Array<{ id: StepId; title: string; description: string }> = [
  { id: "describe", title: "Describe", description: "Research context" },
  { id: "prompt", title: "Prompt", description: "External AI brief" },
  { id: "import", title: "Import", description: "Paste schema JSON" },
  { id: "review", title: "Review", description: "Validate and preview" },
  { id: "publish", title: "Publish", description: "Create public URL" },
];

const draftValueFromInitialDraft = (draft: SerializableCreationDraft): DescribeValue => ({
  constraints: draft.constraints ?? "",
  description: draft.description ?? "",
  questionDescription: draft.questionDescription ?? "",
  researchGoal: draft.researchGoal ?? "",
  title: draft.title ?? "",
});

const schemaTextFromInitialDraft = (schema: unknown) => {
  if (!schema) {
    return "";
  }

  return JSON.stringify(schema, null, 2);
};

function countErrors(report: ValidationReport | null) {
  return report?.findings.filter((finding) => finding.level === "error").length ?? 0;
}

async function readJsonPayload<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function CreationWizard({ initialDraft }: { initialDraft: SerializableCreationDraft }) {
  const [currentStep, setCurrentStep] = useState<StepId>("describe");
  const [draft, setDraft] = useState<DescribeValue>(() => draftValueFromInitialDraft(initialDraft));
  const [schemaText, setSchemaText] = useState(() => schemaTextFromInitialDraft(initialDraft.schema));
  const [parseError, setParseError] = useState<string | null>(null);
  const [schema, setSchema] = useState<SurveySchema | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validatedSchemaText, setValidatedSchemaText] = useState<string | null>(null);
  const [schemaSaveError, setSchemaSaveError] = useState<string | null>(null);
  const [isValidationPending, setIsValidationPending] = useState(Boolean(schemaText.trim()));
  const [surveyId, setSurveyId] = useState<string | null>(initialDraft.createdSurveyId);
  const [publicUrl, setPublicUrl] = useState<string | null>(initialDraft.publicUrl);
  const [isPublishing, setIsPublishing] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const lastSavedDraftRef = useRef(JSON.stringify(draft));
  const lastSavedSchemaRef = useRef<string | null>(initialDraft.schema ? JSON.stringify(initialDraft.schema) : null);
  const schemaRequestIdRef = useRef(0);

  const prompt = useMemo(() => buildExternalSchemaPrompt(draft), [draft]);
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const canPublish = Boolean(
    schema &&
      validationReport &&
      validatedSchemaText === schemaText &&
      !isValidationPending &&
      !parseError &&
      !schemaSaveError &&
      countErrors(validationReport) === 0,
  );
  const flowEditorHref = surveyId ? `/surveys/${surveyId}` : "/workspace";
  const hasPublished = Boolean(publicUrl);

  useEffect(() => {
    const nextDraftSnapshot = JSON.stringify(draft);

    if (nextDraftSnapshot === lastSavedDraftRef.current) {
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/creation-drafts/${initialDraft.id}`, {
          body: nextDraftSnapshot,
          headers: { "content-type": "application/json" },
          method: "PUT",
          signal: controller.signal,
        });

        if (response.ok) {
          lastSavedDraftRef.current = nextDraftSnapshot;
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
        }
      }
    }, 600);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [draft, initialDraft.id]);

  useEffect(() => {
    const requestId = schemaRequestIdRef.current + 1;
    schemaRequestIdRef.current = requestId;

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      if (!schemaText.trim()) {
        setParseError(null);
        setSchema(null);
        setValidationReport(null);
        setValidatedSchemaText(null);
        setSchemaSaveError(null);
        setIsValidationPending(false);
        setWorkflowError(null);
        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(schemaText);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Invalid JSON");
        setSchema(null);
        setValidationReport(null);
        setValidatedSchemaText(null);
        setSchemaSaveError(null);
        setIsValidationPending(false);
        return;
      }

      const schemaResult = SurveySchemaZ.safeParse(parsed);

      if (!schemaResult.success) {
        setParseError(formatSurveySchemaError(schemaResult.error));
        setSchema(null);
        setValidationReport(null);
        setValidatedSchemaText(null);
        setSchemaSaveError(null);
        setIsValidationPending(false);
        return;
      }

      const nextSchema = schemaResult.data;
      const nextSchemaSnapshot = JSON.stringify(nextSchema);

      setParseError(null);
      setSchema(nextSchema);
      setSchemaSaveError(null);
      setWorkflowError(null);

      try {
        if (nextSchemaSnapshot !== lastSavedSchemaRef.current) {
          const saveResponse = await fetch(`/api/creation-drafts/${initialDraft.id}`, {
            body: JSON.stringify({ schema: nextSchema }),
            headers: { "content-type": "application/json" },
            method: "PUT",
            signal: controller.signal,
          });

          if (saveResponse.ok) {
            const payload = await readJsonPayload<SaveCreationDraftResponse>(saveResponse);
            lastSavedSchemaRef.current = nextSchemaSnapshot;

            if (payload?.draft?.createdSurveyId) {
              setSurveyId(payload.draft.createdSurveyId);
            }
          } else if (schemaRequestIdRef.current === requestId) {
            setValidationReport(null);
            setValidatedSchemaText(null);
            setIsValidationPending(false);
            setSchemaSaveError("Schema could not be saved. Validation and publishing are blocked until autosave succeeds.");
            setWorkflowError("Schema could not be saved. Try again before publishing.");
            return;
          }
        }

        if (schemaRequestIdRef.current === requestId) {
          setSchemaSaveError(null);
        }

        const validateResponse = await fetch(`/api/creation-drafts/${initialDraft.id}/validate`, {
          body: JSON.stringify({ schema: nextSchema }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const payload = await readJsonPayload<ValidateResponse>(validateResponse);

        if (schemaRequestIdRef.current === requestId) {
          setValidationReport(validateResponse.ok ? payload?.validationReport ?? null : null);
          setValidatedSchemaText(validateResponse.ok && payload?.validationReport ? schemaText : null);
          setIsValidationPending(false);
          setWorkflowError(validateResponse.ok ? null : "Schema validation request failed.");
        }
      } catch (error) {
        if (!controller.signal.aborted && schemaRequestIdRef.current === requestId) {
          console.error(error);
          setValidatedSchemaText(null);
          setSchemaSaveError("Schema could not be saved or validated. Try again before publishing.");
          setIsValidationPending(false);
          setWorkflowError("Schema validation request failed.");
        }
      }
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [initialDraft.id, schemaText]);

  const handleSchemaTextChange = useCallback((nextSchemaText: string) => {
    schemaRequestIdRef.current += 1;
    setSchemaText(nextSchemaText);
    setParseError(null);
    setSchema(null);
    setValidationReport(null);
    setValidatedSchemaText(null);
    setSchemaSaveError(null);
    setIsValidationPending(Boolean(nextSchemaText.trim()));
  }, []);

  const finalizeIfNeeded = useCallback(async () => {
    if (surveyId) {
      return surveyId;
    }

    try {
      const response = await fetch(`/api/creation-drafts/${initialDraft.id}/finalize`, { method: "POST" });
      const payload = await readJsonPayload<FinalizeResponse>(response);

      if (!response.ok || !payload?.surveyId) {
        setWorkflowError("Survey finalization failed. Review validation errors and try again.");
        return null;
      }

      setSurveyId(payload.surveyId);
      return payload.surveyId;
    } catch (error) {
      console.error(error);
      setWorkflowError("Survey finalization failed. Review validation errors and try again.");
      return null;
    }
  }, [initialDraft.id, surveyId]);

  const publish = useCallback(async () => {
    setIsPublishing(true);
    setWorkflowError(null);

    try {
      const nextSurveyId = await finalizeIfNeeded();

      if (!nextSurveyId) {
        return;
      }

      const response = await fetch(`/api/surveys/${nextSurveyId}/publish`, { method: "POST" });
      const payload = await readJsonPayload<PublishResponse>(response);

      if (payload?.validationReport) {
        setValidationReport(payload.validationReport);
      }

      if (!response.ok || !payload?.publicUrl) {
        setWorkflowError("Publishing failed. Review validation errors and try again.");
        return;
      }

      setPublicUrl(payload.publicUrl);
    } catch (error) {
      console.error(error);
      setWorkflowError("Publishing failed. Review validation errors and try again.");
    } finally {
      setIsPublishing(false);
    }
  }, [finalizeIfNeeded]);

  const goBack = () => {
    setCurrentStep(steps[Math.max(currentIndex - 1, 0)].id);
  };

  const goNext = () => {
    setCurrentStep(steps[Math.min(currentIndex + 1, steps.length - 1)].id);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-700">New survey</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Creation wizard</h1>
      </div>
      <Stepper currentStep={currentIndex} steps={steps} />
      <Panel>
        {currentStep === "describe" ? <DescribeStep onChange={setDraft} value={draft} /> : null}
        {currentStep === "prompt" ? <PromptStep prompt={prompt} /> : null}
        {currentStep === "import" ? (
          <ImportStep
            flowEditorHref={flowEditorHref}
            isPublished={Boolean(publicUrl)}
            isFlowEditorDisabled={!surveyId}
            onChange={handleSchemaTextChange}
            parseError={parseError}
            schemaText={schemaText}
            validationReport={validationReport}
          />
        ) : null}
        {currentStep === "review" ? (
          <ReviewStep
            flowEditorHref={flowEditorHref}
            isPublished={Boolean(publicUrl)}
            isFlowEditorDisabled={!surveyId}
            schema={schema}
            schemaText={schemaText}
            validationReport={validationReport}
          />
        ) : null}
        {currentStep === "publish" ? (
          <PublishStep
            canPublish={canPublish}
            isPublishing={isPublishing}
            onPublish={publish}
            publicUrl={publicUrl}
          />
        ) : null}
      </Panel>
      {schemaSaveError ? (
        <p className="text-sm text-red-600" role="alert">
          {schemaSaveError}
        </p>
      ) : null}
      {workflowError ? (
        <p className="text-sm text-red-600" role="alert">
          {workflowError}
        </p>
      ) : null}
      {hasPublished ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hs-border)] pt-4">
          <div className="flex items-center gap-2">
            <StatusBadge tone="published">Published</StatusBadge>
            <span className="text-sm text-[var(--hs-muted)]">This survey is ready for collection.</span>
          </div>
          <LinkButton href={flowEditorHref} variant="secondary">
            Open in Flow Editor
          </LinkButton>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-3">
          <Button disabled={currentIndex === 0} onClick={goBack} type="button" variant="secondary">
            Back
          </Button>
          <Button disabled={currentStep === "publish"} onClick={goNext} type="button">
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
