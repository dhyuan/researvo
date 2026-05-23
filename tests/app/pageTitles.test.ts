import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("page titles", () => {
  it("uses a site title template from the root layout", () => {
    const source = read("app/layout.tsx");

    expect(source).toContain('template: "%s | Researvo"');
    expect(source).toContain('default: "Researvo"');
  });

  it("sets explicit titles for top-level publisher pages", () => {
    expect(read("app/page.tsx")).toContain('absolute: "Sign In | Researvo"');
    expect(read("app/(publisher)/workspace/page.tsx")).toContain('absolute: "Workspace | Researvo"');
    expect(read("app/(publisher)/surveys/new/wizard/page.tsx")).toContain('absolute: "New Survey Wizard | Researvo"');
    expect(read("app/(publisher)/surveys/[surveyId]/page.tsx")).toContain('absolute: "Survey Editor | Researvo"');
    expect(read("app/(publisher)/settings/page.tsx")).toContain('absolute: "Settings | Researvo"');
    expect(read("app/(publisher)/profile/page.tsx")).toContain('absolute: "Profile | Researvo"');
    expect(read("app/surveys/new/page.tsx")).toContain('absolute: "Create Survey | Researvo"');
  });

  it("sets a dynamic title for public survey pages", () => {
    const source = read("app/public/s/[publicId]/page.tsx");

    expect(source).toContain("generateMetadata");
    expect(source).toContain('absolute: version?.survey.title ? `${version.survey.title} | Researvo` : "Survey | Researvo"');
  });
});
