import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/survey/SurveyMaintenanceClient.tsx", "utf8");

describe("SurveyMaintenanceClient tabs", () => {
  it("uses the survey title in the page heading instead of showing the schema label", () => {
    expect(source).toContain("const surveyTitle = parsedSchemaResult.success ? parsedSchemaResult.data.survey.title : surveyId;");
    expect(source).toContain("{surveyTitle}");
    expect(source).not.toContain(">Survey schema<");
  });

  it("disables publish when the current schema matches the latest published version", () => {
    expect(source).toContain("const [lastPublishedSchemaText, setLastPublishedSchemaText] = useState<string | null>(null);");
    expect(source).toContain("const publishHasChanges = !lastPublishedSchemaText || currentSchemaSnapshot !== lastPublishedSchemaText;");
    expect(source).toContain("const isPublishDisabled = Boolean(parsedSchema.error) || hasBlockingErrors || !publishHasChanges;");
    expect(source).toContain("disabled={isPublishDisabled}");
  });

  it("shows copy and open controls for the latest published public URL", () => {
    expect(source).toContain("latestVersion?: { publicId?: string; schema: unknown } | null");
    expect(source).toContain('setPublicUrl(payload.latestVersion?.publicId ? `/public/s/${payload.latestVersion.publicId}` : null);');
    expect(source).toContain('<CopyButton label="Copy URL" text={publicUrl} />');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noreferrer"');
  });

  it("ignores saved flow node positions when comparing publish changes", () => {
    expect(source).toContain("const schemaWithoutFlowLayout = (schema: SurveySchema): SurveySchema => {");
    expect(source).toContain("delete metadata.flowLayout;");
    expect(source).toContain("return schemaResult.success ? JSON.stringify(schemaWithoutFlowLayout(schemaResult.data)) : null;");
    expect(source).toContain("const currentSchemaSnapshot = parsedSchemaResult.success ? JSON.stringify(schemaWithoutFlowLayout(parsedSchemaResult.data)) : null;");
  });

  it("opens the flow tab by default when a survey is opened", () => {
    expect(source).toContain('const [activeTab, setActiveTab] = useState("flow");');
  });

  it("shows metrics and exports as first-level survey tabs", () => {
    expect(source).toMatch(/<TabsTrigger value="metrics"[^>]*>/);
    expect(source).toMatch(/<TabsContent value="metrics"[^>]*>/);
    expect(source).toMatch(/<TabsTrigger value="exports"[^>]*>/);
    expect(source).toMatch(/<TabsContent value="exports"[^>]*>/);
    expect(source).not.toContain('<section className="mt-8 grid gap-6 lg:grid-cols-2">');
  });

  it("refreshes metrics when the metrics tab is selected", () => {
    expect(source).toContain('const [activeTab, setActiveTab] = useState("flow");');
    expect(source).toMatch(/const handleTabChange = \(value: string\) => \{\s*setActiveTab\(value\);\s*if \(value === "metrics"\) \{\s*void refreshMetrics\(\);/);
    expect(source).toContain('<Tabs value={activeTab} onValueChange={handleTabChange}');
  });
});
