import type { SurveyPolicy } from "@/lib/schema/surveySchema";

export type AccessGateResult =
  | { allowed: true; accessMode: "anonymous" }
  | { allowed: false; reason: "ACCESS_MODE_NOT_ENABLED" };

export const startAnonymousAccess = (policy: SurveyPolicy): AccessGateResult => {
  if (policy.accessMode !== "anonymous") {
    return { allowed: false, reason: "ACCESS_MODE_NOT_ENABLED" };
  }

  return { allowed: true, accessMode: "anonymous" };
};
