import { NextResponse } from "next/server";

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/currentUser";

export function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return null;
}
