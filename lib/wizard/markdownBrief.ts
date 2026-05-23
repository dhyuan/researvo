export type WizardBriefMarkdownValue = {
  title: string;
  description: string;
  researchGoal: string;
  questionDescription: string;
  constraints: string;
};

type SectionKey = Exclude<keyof WizardBriefMarkdownValue, "title">;

const sectionHeadings: Array<{ key: SectionKey; title: string }> = [
  { key: "description", title: "Description" },
  { key: "researchGoal", title: "Goal" },
  { key: "questionDescription", title: "Questions" },
  { key: "constraints", title: "Constraints" },
];

const headingToKey: Record<string, SectionKey> = {
  constraints: "constraints",
  description: "description",
  goal: "researchGoal",
  questions: "questionDescription",
};

export class WizardBriefMarkdownError extends Error {
  constructor(message = "Invalid wizard markdown brief") {
    super(message);
    this.name = "WizardBriefMarkdownError";
  }
}

function normalizeLineEndings(markdown: string) {
  return markdown.replace(/\r\n?/g, "\n");
}

function cleanSectionValue(value: string | undefined) {
  return (value ?? "").trim();
}

export function formatWizardBriefMarkdown(value: WizardBriefMarkdownValue) {
  const lines = [`# ${value.title.trim()}`, ""];

  sectionHeadings.forEach((section) => {
    lines.push(`## ${section.title}`);
    lines.push(value[section.key].trim());
    lines.push("");
  });

  return lines.join("\n");
}

export function parseWizardBriefMarkdown(markdown: string): WizardBriefMarkdownValue {
  const normalized = normalizeLineEndings(markdown);
  const titleMatch = normalized.match(/^#\s+(.+?)\s*$/m);
  const sections: Partial<Record<SectionKey, string[]>> = {};
  let currentSection: SectionKey | null = null;

  for (const line of normalized.split("\n")) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);

    if (sectionMatch) {
      currentSection = headingToKey[sectionMatch[1].trim().toLowerCase()] ?? null;

      if (currentSection && !sections[currentSection]) {
        sections[currentSection] = [];
      }

      continue;
    }

    if (currentSection) {
      sections[currentSection]?.push(line);
    }
  }

  const value: WizardBriefMarkdownValue = {
    constraints: cleanSectionValue(sections.constraints?.join("\n")),
    description: cleanSectionValue(sections.description?.join("\n")),
    questionDescription: cleanSectionValue(sections.questionDescription?.join("\n")),
    researchGoal: cleanSectionValue(sections.researchGoal?.join("\n")),
    title: cleanSectionValue(titleMatch?.[1]),
  };

  if (!value.title || !value.description || !value.researchGoal || !value.questionDescription) {
    throw new WizardBriefMarkdownError();
  }

  return value;
}
