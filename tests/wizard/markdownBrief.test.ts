import { describe, expect, it } from "vitest";

import {
  formatWizardBriefMarkdown,
  parseWizardBriefMarkdown,
  WizardBriefMarkdownError,
} from "@/lib/wizard/markdownBrief";

describe("wizard markdown brief", () => {
  it("formats a wizard brief as markdown", () => {
    expect(
      formatWizardBriefMarkdown({
        constraints: "Do not collect PII.",
        description: "Understand respondent needs.",
        questionDescription: "1. What matters most?\n2. Why?",
        researchGoal: "Learn product discovery signals.",
        title: "Discovery survey",
      }),
    ).toBe(`# Discovery survey

## Description
Understand respondent needs.

## Goal
Learn product discovery signals.

## Questions
1. What matters most?
2. Why?

## Constraints
Do not collect PII.
`);
  });

  it("parses exported markdown back into wizard values", () => {
    const markdown = formatWizardBriefMarkdown({
      constraints: "Anonymous only.",
      description: "A short description.",
      questionDescription: "Ask about satisfaction.",
      researchGoal: "Measure satisfaction drivers.",
      title: "Satisfaction survey",
    });

    expect(parseWizardBriefMarkdown(markdown)).toEqual({
      constraints: "Anonymous only.",
      description: "A short description.",
      questionDescription: "Ask about satisfaction.",
      researchGoal: "Measure satisfaction drivers.",
      title: "Satisfaction survey",
    });
  });

  it("parses section headings case-insensitively", () => {
    expect(
      parseWizardBriefMarkdown(`# Case Survey

## description
Description text.

## GOAL
Goal text.

## questions
Question text.

## constraints
Constraint text.
`),
    ).toEqual({
      constraints: "Constraint text.",
      description: "Description text.",
      questionDescription: "Question text.",
      researchGoal: "Goal text.",
      title: "Case Survey",
    });
  });

  it("rejects markdown missing required title, description, goal, or questions content", () => {
    expect(() =>
      parseWizardBriefMarkdown(`# Required Fields

## Description
Description text.

## Goal

## Questions
Question text.
`),
    ).toThrow(WizardBriefMarkdownError);
  });

  it("allows missing constraints by returning an empty value", () => {
    expect(
      parseWizardBriefMarkdown(`# Optional Constraints

## Description
Description text.

## Goal
Goal text.

## Questions
Question text.
`),
    ).toEqual({
      constraints: "",
      description: "Description text.",
      questionDescription: "Question text.",
      researchGoal: "Goal text.",
      title: "Optional Constraints",
    });
  });

  it("preserves multiline section content", () => {
    expect(
      parseWizardBriefMarkdown(`# Multiline

## Description
Line one.

Line two.

## Goal
Goal line one.
Goal line two.

## Questions
- First question?
- Second question?

## Constraints
- No names.
- No emails.
`),
    ).toEqual({
      constraints: "- No names.\n- No emails.",
      description: "Line one.\n\nLine two.",
      questionDescription: "- First question?\n- Second question?",
      researchGoal: "Goal line one.\nGoal line two.",
      title: "Multiline",
    });
  });
});
