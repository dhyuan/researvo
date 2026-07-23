import { NextResponse } from "next/server";

import { isFeedbackAdminAuthorized } from "@/lib/feedback/adminAuth";
import { getPushConfig } from "@/lib/push/pushConfig";

export async function GET(request: Request) {
  if (!isFeedbackAdminAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const config = getPushConfig();
  if (!config.configured) {
    return NextResponse.json({
      configured: false,
      publicKey: null,
      reason: config.reason,
    });
  }

  return NextResponse.json({
    configured: true,
    publicKey: config.publicKey,
  });
}
