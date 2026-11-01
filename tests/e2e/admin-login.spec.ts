import { expect, test } from "@playwright/test";

test("submits a password filled without input events and offers credential hints", async ({ page }) => {
  let submitted: unknown;
  await page.route("**/api/admin/session", async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 401, json: { error: "INVALID_ADMIN_TOKEN" } });
    } else {
      await route.fulfill({ json: { authenticated: false, configured: true } });
    }
  });
  await page.goto("/admin/login");
  const password = page.getByLabel("管理访问密钥", { exact: true });
  await expect(password).toBeVisible();
  // Some password providers update the native value without React input events.
  await password.evaluate((input: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "autofilled-test-secret");
  });
  await page.getByRole("button", { name: /进入/ }).click();
  await expect.poll(() => submitted).toEqual({ token: "autofilled-test-secret" });
  await expect(password).toHaveAttribute("name", "password");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(page.locator('input[autocomplete="username"]')).toHaveValue("admin");
});
