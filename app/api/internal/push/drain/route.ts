import { NextResponse } from "next/server";

import { drainPushOutbox } from "@/lib/push/pushDispatcher";
import { getPushDispatchSecret } from "@/lib/push/pushConfig";
import { safeSecretEqual } from "@/lib/push/pushHttp";

export const runtime = "nodejs";
export const maxDuration = 55;

function dispatchCredential(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return request.headers.get("x-push-dispatch-secret");
}

export async function POST(request: Request) {
  const secret = getPushDispatchSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "PUSH_DISPATCH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  if (!safeSecretEqual(dispatchCredential(request), secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await drainPushOutbox({ limit: 50 });
  return NextResponse.json(result, {
    status: result.configured ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
