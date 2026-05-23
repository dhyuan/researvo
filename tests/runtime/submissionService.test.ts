import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { normalizeSubmission } from "@/lib/runtime/submissionService";

describe("normalizeSubmission", () => {
  it("keeps coded closed-choice values instead of labels", () => {
    const submission = normalizeSubmission({
      schema: exampleSurveySchema,
      answers: { gender: 1 },
      shownNodeIds: ["consent", "q_gender", "end"],
      branchPath: ["consent", "q_gender", "end"],
    });

    expect(submission.answers).toEqual({ gender: 1 });
    expect(submission.missingValues).toEqual({});
  });

  it("marks variables as not_shown when their question node was not displayed", () => {
    const submission = normalizeSubmission({
      schema: exampleSurveySchema,
      answers: {},
      shownNodeIds: ["consent", "end"],
      branchPath: ["consent", "end"],
    });

    expect(submission.answers).toEqual({});
    expect(submission.missingValues).toEqual({ gender: "not_shown" });
  });
});
