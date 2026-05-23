import { describe, expect, it } from "vitest";
import { calculateSurveyMetrics } from "@/lib/metrics/metricsService";

describe("calculateSurveyMetrics", () => {
  it("calculates started, completed, completion rate, and average seconds", () => {
    const metrics = calculateSurveyMetrics([
      {
        status: "completed",
        startedAt: new Date("2026-01-01T00:00:00Z"),
        submittedAt: new Date("2026-01-01T00:01:00Z"),
      },
      {
        status: "started",
        startedAt: new Date("2026-01-01T00:02:00Z"),
        submittedAt: null,
      },
    ]);

    expect(metrics.startedCount).toBe(2);
    expect(metrics.completedCount).toBe(1);
    expect(metrics.completionRate).toBe(0.5);
    expect(metrics.averageCompletionSeconds).toBe(60);
  });

  it("returns null average completion time when no sessions are complete", () => {
    const metrics = calculateSurveyMetrics([
      {
        status: "started",
        startedAt: new Date("2026-01-01T00:02:00Z"),
        submittedAt: null,
      },
    ]);

    expect(metrics.startedCount).toBe(1);
    expect(metrics.completedCount).toBe(0);
    expect(metrics.completionRate).toBe(0);
    expect(metrics.averageCompletionSeconds).toBeNull();
  });
});
