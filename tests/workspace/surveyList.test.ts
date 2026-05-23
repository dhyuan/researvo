import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync("components/workspace/SurveyList.tsx", "utf8");
const serviceSource = readFileSync("lib/surveys/surveyListService.ts", "utf8");
const repositorySource = readFileSync("lib/persistence/repositories.ts", "utf8");

describe("Survey library list", () => {
  it("maps respondent session count into participant count", () => {
    expect(repositorySource).toContain("_count: {");
    expect(repositorySource).toContain("sessions: true");
    expect(serviceSource).toContain("participantCount: latestVersion?._count.sessions ?? 0");
  });

  it("shows participants after version and labels the action as edit", () => {
    expect(componentSource).toContain("participantCount: number;");
    expect(componentSource).toContain(">Participants<");
    expect(componentSource).toContain("{survey.participantCount}");
    expect(componentSource).toContain("aria-label={`Edit ${survey.title}`}");
    expect(componentSource).toContain("Edit");
    expect(componentSource).not.toContain(">Open<");
  });

  it("does not show public URLs in the library list", () => {
    expect(componentSource).not.toContain(">Public URL<");
    expect(componentSource).not.toContain("survey.publicUrl");
  });

  it("supports active published and archived filters", () => {
    expect(componentSource).toContain('type SurveyFilter = "all" | "published" | "archived";');
    expect(componentSource).toContain("filterTabs");
    expect(componentSource).toContain("Archived");
    expect(serviceSource).toContain('filter: "all" | "published" | "archived" = "all"');
    expect(serviceSource).toContain('if (filter === "archived")');
    expect(serviceSource).toContain("survey.archivedAt");
  });

  it("provides an archive action for active surveys", () => {
    expect(componentSource).toContain("ArchiveSurveyButton");
    expect(componentSource).toContain("archivedAt: Date | null;");
    expect(repositorySource).toContain("export async function archiveSurvey");
    expect(repositorySource).toContain("archivedAt: new Date()");
  });

  it("provides a confirmed destructive delete action", () => {
    expect(componentSource).toContain("DeleteSurveyButton");
    expect(repositorySource).toContain("export async function deleteSurvey");
    expect(repositorySource).toContain("submissionRecord.deleteMany");
    expect(repositorySource).toContain("survey.delete");
  });
});
