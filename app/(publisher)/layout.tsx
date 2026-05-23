import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ForbiddenError, requirePublisher, UnauthorizedError } from "@/lib/auth/currentUser";

export default async function PublisherLayout({ children }: { children: ReactNode }) {
  try {
    await requirePublisher();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      redirect("/");
    }

    throw error;
  }

  return <AppShell>{children}</AppShell>;
}
