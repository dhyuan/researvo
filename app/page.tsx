import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { SSO_PROVIDER_COOKIE } from "@/lib/analytics/googleAnalytics";

export const metadata: Metadata = {
  title: {
    absolute: "Sign In | Researvo",
  },
};

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/workspace");
  }

  async function signInWithGoogle() {
    "use server";

    (await cookies()).set(SSO_PROVIDER_COOKIE, "google", {
      maxAge: 15 * 60,
      path: "/",
      sameSite: "lax",
    });
    await signIn("google", { redirectTo: "/workspace?auth_status=success&auth_provider=google" });
  }

  async function signInWithApple() {
    "use server";

    (await cookies()).set(SSO_PROVIDER_COOKIE, "apple", {
      maxAge: 15 * 60,
      path: "/",
      sameSite: "lax",
    });
    await signIn("apple", { redirectTo: "/workspace?auth_status=success&auth_provider=apple" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--hs-primary)]">Researvo</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            Build research-grade surveys from a stable schema.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            Create, validate, publish, collect, and export structured survey data in one publisher workspace.
          </p>
        </section>
        <Panel className="p-6">
          <h2 className="text-xl font-semibold text-slate-950">Sign in to continue</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">Use your publisher account to open the workspace.</p>
          <div className="mt-6 grid gap-3">
            <form action={signInWithGoogle}>
              <Button className="w-full" data-analytics-label="Sign in with Google" type="submit">
                Sign in with Google
              </Button>
            </form>
            <form action={signInWithApple}>
              <Button className="w-full" data-analytics-label="Sign in with Apple" type="submit" variant="secondary">
                Sign in with Apple
              </Button>
            </form>
          </div>
        </Panel>
      </div>
    </main>
  );
}
