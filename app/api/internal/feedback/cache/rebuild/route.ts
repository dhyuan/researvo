import { NextResponse } from "next/server";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import { rebuildFeedbackCache } from "@/lib/feedback/feedbackCache";

export async function POST(request: Request) {
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
    return NextResponse.json(await rebuildFeedbackCache(), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("Failed to rebuild feedback cache", {
      error: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { error: "FEEDBACK_CACHE_REBUILD_FAILED" },
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }
}
