import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/wizard/CreationWizard.tsx", "utf8");
const importStepSource = readFileSync("components/wizard/ImportStep.tsx", "utf8");
const newWizardPageSource = readFileSync("app/(publisher)/surveys/new/wizard/page.tsx", "utf8");
const publishStepSource = readFileSync("components/wizard/PublishStep.tsx", "utf8");
const reviewStepSource = readFileSync("components/wizard/ReviewStep.tsx", "utf8");

describe("CreationWizard", () => {
  it("tracks the survey created by schema autosave", () => {
    expect(source).toContain("type SaveCreationDraftResponse = {");
    expect(source).toContain("setSurveyId(payload.draft.createdSurveyId);");
  });

  it("offers a flow editor shortcut on import and review steps", () => {
    expect(source).toContain('const flowEditorHref = surveyId ? `/surveys/${surveyId}` : "/workspace";');
    expect(source).toContain("flowEditorHref={flowEditorHref}");
    expect(source).toContain("isFlowEditorDisabled={!surveyId}");
    expect(importStepSource).toContain("Open Flow editor");
    expect(importStepSource).toContain("disabled={isFlowEditorDisabled}");
    expect(reviewStepSource).toContain("Open Flow editor");
    expect(reviewStepSource).toContain("disabled={isFlowEditorDisabled}");
  });

  it("places the review shortcut inside the schema summary panel with stronger visual weight", () => {
    expect(reviewStepSource).toContain("Schema summary");
    expect(reviewStepSource).toContain("flowEditorHref: string;");
    expect(reviewStepSource).toContain("isFlowEditorDisabled: boolean;");
    expect(reviewStepSource).toContain('variant="primary"');
    expect(reviewStepSource).toContain("shadow-[0_16px_30px_-18px_rgba(23,70,63,0.95)]");
  });

  it("hydrates publication state for a previously published wizard survey", () => {
    expect(newWizardPageSource).toContain("getLatestSurveyVersion");
    expect(newWizardPageSource).toContain("publicUrl: latestVersion ? `/public/s/${latestVersion.publicId}` : null");
    expect(source).toContain("publicUrl: string | null;");
    expect(source).toContain("useState<string | null>(initialDraft.publicUrl)");
  });

  it("shows published status in import and review summaries", () => {
    expect(importStepSource).toContain("isPublished: boolean;");
    expect(importStepSource).toContain('isPublished ? "Published"');
    expect(importStepSource).toContain('tone={isPublished ? "published"');
    expect(reviewStepSource).toContain("isPublished: boolean;");
    expect(reviewStepSource).toContain('isPublished ? "Published"');
    expect(reviewStepSource).toContain('tone={isPublished ? "published"');
  });

  it("replaces publish action with the existing public URL when already published", () => {
    expect(publishStepSource).toContain("const isPublished = Boolean(publicUrl);");
    expect(publishStepSource).toContain("{!isPublished ? (");
    expect(publishStepSource).toContain('target="_blank"');
    expect(publishStepSource).toContain('rel="noreferrer"');
  });

  it("shows a completed footer instead of back and next after publishing", () => {
    expect(source).toContain("const hasPublished = Boolean(publicUrl);");
    expect(source).toContain("{hasPublished ? (");
    expect(source).toContain("Published");
    expect(source).toContain("Open in Flow Editor");
    expect(source).toContain('href={flowEditorHref}');
    expect(source).toContain(") : (");
  });
});
