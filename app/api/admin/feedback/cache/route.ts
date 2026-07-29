import { NextResponse } from "next/server";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import {
  ensureFeedbackCacheReady,
  getFeedbackCacheStatus,
} from "@/lib/feedback/feedbackCache";

export async function GET(request: Request) {
  if (!isFeedbackAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  try {
    await ensureFeedbackCacheReady();
    return NextResponse.json(getFeedbackCacheStatus(), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("Failed to load feedback cache status", {
      error: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { error: "FEEDBACK_CACHE_STATUS_FAILED" },
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
}
