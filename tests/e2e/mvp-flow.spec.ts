import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";

const hasDatabase = Boolean(process.env.DATABASE_URL);

type PublishApiResponse = {
  version?: {
    surveyId?: string;
  };
};

test.describe("MVP survey workflow", () => {
  test.skip(!hasDatabase, "DATABASE_URL is required for persistence-backed E2E tests");

  test.beforeAll(() => {
    execSync("npx prisma db push", { stdio: "inherit" });
  });

  test("creates, publishes, completes, measures, and exports a survey", async ({ page }) => {
    await page.goto("/surveys/new/wizard");
    await expect(page.getByRole("heading", { name: "Creation wizard" })).toBeVisible();

    await page.getByLabel("Survey title").fill("E2E publisher wizard survey");
    await page.getByLabel("Short description").fill("A short E2E survey description.");
    await page.getByLabel("Research goal").fill("Verify that authenticated publishers can create surveys in the wizard.");
    await page
      .getByLabel("Question description")
      .fill("Ask respondents for gender using the standard example response options.");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Return only valid JSON")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Schema JSON").fill(JSON.stringify(exampleSurveySchema, null, 2));
    await expect(page.getByText("errors (0)", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Ready")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    const publishResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/surveys/") && response.url().endsWith("/publish"),
    );
    await page.getByRole("button", { name: "Publish survey" }).click();
    const publishPayload = (await (await publishResponsePromise).json()) as PublishApiResponse;
    const operatorSurveyId = publishPayload.version?.surveyId;
    expect(operatorSurveyId).toBeTruthy();

    const publicLink = page.getByRole("link", { name: /\/public\/s\/s_/ });
    await expect(publicLink).toBeVisible();
    const publicHref = await publicLink.getAttribute("href");
    expect(publicHref).toBeTruthy();
    const operatorPageUrl = `/surveys/${operatorSurveyId}`;

    await page.goto(publicHref!);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Male").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("heading", { name: "Response submitted" })).toBeVisible();

    await page.goto(operatorPageUrl);
    await page.getByRole("button", { name: "Refresh metrics" }).click();
    await expect(page.getByText("Completed")).toBeVisible();
    await expect(page.locator("dt", { hasText: "Completed" }).locator("xpath=following-sibling::dd")).toHaveText("1");

    const csvResponse = await page.evaluate(async (surveyId) => {
      const response = await fetch(`/api/surveys/${surveyId}/exports?format=csv`);

      return {
        ok: response.ok,
        text: await response.text(),
      };
    }, operatorSurveyId);
    expect(csvResponse.ok).toBe(true);
    expect(csvResponse.text).toContain("gender");

    const zipResponse = await page.evaluate(async (surveyId) => {
      const response = await fetch(`/api/surveys/${surveyId}/exports?format=zip`);
      const bytes = Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 4));

      return {
        bytes,
        contentType: response.headers.get("content-type"),
        ok: response.ok,
      };
    }, operatorSurveyId);
    expect(zipResponse.ok).toBe(true);
    expect(zipResponse.contentType).toContain("application/zip");
    expect(zipResponse.bytes).toEqual([80, 75, 3, 4]);
  });
});
