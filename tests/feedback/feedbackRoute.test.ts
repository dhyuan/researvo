import { beforeEach, describe, expect, it, vi } from "vitest";

const submitFeedback = vi.fn();

vi.mock("@/lib/feedback/feedbackService", () => ({
  submitFeedback,
}));

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("feedback route", () => {
  beforeEach(() => {
    submitFeedback.mockReset();
  });

  it("stores feedback when the app token matches", async () => {
    submitFeedback.mockResolvedValueOnce({ id: "feedback_1" });
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        message: "The copy practice screen needs a larger text area.",
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, feedbackId: "feedback_1" });
    expect(response.status).toBe(200);
    expect(submitFeedback).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      message: "The copy practice screen needs a larger text area.",
    });
  });

  it("accepts optional channel, device, and version fields", async () => {
    submitFeedback.mockResolvedValueOnce({ id: "feedback_2" });
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
        channel: "web",
        device: "iPhone 15 Pro",
        version: "1.4.2",
        message: "The writing panel is hard to use on mobile.",
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, feedbackId: "feedback_2" });
    expect(response.status).toBe(200);
    expect(submitFeedback).toHaveBeenCalledWith({
      token: "valid-token",
      sourceApp: "ChineseHandCopy",
      channel: "web",
      device: "iPhone 15 Pro",
      version: "1.4.2",
      message: "The writing panel is hard to use on mobile.",
    });
  });

  it("returns 401 when the token does not match the source app", async () => {
    submitFeedback.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "wrong-token",
        sourceApp: "ChineseHandCopy",
        message: "I found a bug.",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_FEEDBACK_TOKEN" });
    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/feedback/route");

    const response = await POST(
      makeRequest({
        token: "valid-token",
        sourceApp: "ChineseHandCopy",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "INVALID_FEEDBACK_REQUEST" });
    expect(response.status).toBe(400);
    expect(submitFeedback).not.toHaveBeenCalled();
  });
});
