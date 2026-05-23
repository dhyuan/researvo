import { describe, expect, it } from "vitest";

import {
  buildPageViewEventParameters,
  buildSsoLoginEventParameters,
  buildPageButtonName,
  getAnalyticsPageTitle,
  getButtonName,
  getPageName,
  getPagePattern,
} from "@/lib/analytics/googleAnalytics";

describe("google analytics helpers", () => {
  it("turns tracked paths into stable page names", () => {
    expect(getPageName("/workspace")).toBe("workspace");
    expect(getPageName("/surveys/new/wizard")).toBe("surveys_new_wizard");
    expect(getPageName("/surveys/cmpi5yg2h0003ie04wru1tpep")).toBe("surveys_detail");
  });

  it("turns dynamic tracked paths into stable page patterns", () => {
    expect(getPagePattern("/workspace")).toBe("/workspace");
    expect(getPagePattern("/surveys/new/wizard")).toBe("/surveys/new/wizard");
    expect(getPagePattern("/surveys/cmpi5yg2h0003ie04wru1tpep")).toBe("/surveys/[id]");
  });

  it("uses stable analytics titles instead of the default root title", () => {
    expect(getAnalyticsPageTitle("/workspace", "Researvo")).toBe("Workspace | Researvo");
    expect(getAnalyticsPageTitle("/surveys/new/wizard", "Researvo")).toBe("New Survey Wizard | Researvo");
    expect(getAnalyticsPageTitle("/surveys/cmpi5yg2h0003ie04wru1tpep", "Researvo")).toBe("Survey Editor | Researvo");
  });

  it("keeps public survey document titles when they are available", () => {
    expect(getAnalyticsPageTitle("/public/s/abc123", "Customer Feedback | Researvo")).toBe("Customer Feedback | Researvo");
    expect(getAnalyticsPageTitle("/public/s/abc123", "Researvo")).toBe("Survey | Researvo");
  });

  it("builds manual page_view event parameters with the analytics title", () => {
    expect(
      buildPageViewEventParameters({
        documentTitle: "Researvo",
        pageLocation: "https://example.test/workspace?filter=published",
        pathname: "/workspace",
      }),
    ).toEqual({
      page_location: "https://example.test/workspace?filter=published",
      page_name: "workspace",
      page_path: "/workspace",
      page_pattern: "/workspace",
      page_title: "Workspace | Researvo",
    });
  });

  it("builds SSO login success event parameters from callback query params", () => {
    expect(buildSsoLoginEventParameters(new URLSearchParams("auth_status=success&auth_provider=google"), "")).toEqual({
      auth_status: "success",
      sso_provider: "google",
    });
  });

  it("builds SSO login failure event parameters from auth error and provider cookie", () => {
    expect(buildSsoLoginEventParameters(new URLSearchParams("error=OAuthCallback"), "researvo_sso_provider=apple")).toEqual({
      auth_error: "OAuthCallback",
      auth_status: "failure",
      sso_provider: "apple",
    });
  });

  it("does not build SSO login event parameters without a login result", () => {
    expect(buildSsoLoginEventParameters(new URLSearchParams("filter=all"), "researvo_sso_provider=google")).toBeNull();
  });

  it("combines page and button names for click reporting", () => {
    expect(buildPageButtonName("surveys_new_wizard", "Next")).toBe("surveys_new_wizard+Next");
  });

  it("prefers explicit analytics labels before visible text", () => {
    const button = {
      getAttribute(name: string) {
        return name === "data-analytics-label" ? "Publish survey" : null;
      },
      textContent: "Publish",
    } as Element;

    expect(getButtonName(button)).toBe("Publish survey");
  });
});
