# Publisher Workspace Auth Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add publisher SSO, publisher profile, authenticated workspace, full-page creation wizard, automatic validation, protected survey ownership, and compressed exports.

**Architecture:** Auth.js owns publisher sessions through Prisma database sessions. Publisher-only app routes call a small auth boundary before reading or mutating surveys. The creation wizard stores pre-schema work in `SurveyCreationDraft`, converts that draft into `Survey` plus `SurveyDraft` after a valid schema import, and then reuses the existing validation, publishing, metrics, runtime, and export modules.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Prisma/PostgreSQL, Auth.js/NextAuth, `@auth/prisma-adapter`, `fflate`, Vitest, Playwright.

---

## Implementation Architecture Decisions

1. Use Auth.js v5 style exports in root `auth.ts`.
   - Install `next-auth@beta` and `@auth/prisma-adapter`, matching the current Auth.js plus Prisma App Router guide.
   - Use Prisma database sessions, not JWT sessions, so account/session data stays inspectable in the database.
   - Do not protect routes through middleware because Prisma adapter access from middleware can run into runtime constraints. Protect server pages, route handlers, and server actions with `auth()` and local helpers.

2. Keep `publisher` as the only exposed role.
   - Add `UserRole` enum with `publisher` and `respondent`.
   - Default all new users to `publisher`.
   - Add `PublisherProfile` as an optional one-to-one profile table.

3. Add a test-only auth bypass boundary, not a UI login bypass.
   - `lib/auth/currentUser.ts` supports `AUTH_TRUST_TEST_USER=true` plus `AUTH_TEST_USER_EMAIL` only when `NODE_ENV !== "production"`.
   - This keeps Playwright and API integration tests workable without adding email/password login to the product.

4. Store wizard autosave in a separate `SurveyCreationDraft`.
   - This avoids creating a real `Survey` before the user has imported a valid Researvo schema.
   - When the Import step receives a schema that passes `SurveySchemaZ`, finalization creates `Survey` and `SurveyDraft`, stores `createdSurveyId`, and keeps the creation draft as a historical wizard record.

5. Use an in-memory per-process rate limiter for the first implementation.
   - Protect survey creation and creation-draft finalization.
   - Return HTTP 429 with `RATE_LIMITED`.
   - This is enough for the current local/single-instance MVP and keeps the interface small enough to replace with Redis storage in a separate scaling task.

6. Use local Tailwind components, not a new UI framework.
   - Create focused primitives under `components/ui/`.
   - Use the clean blue research workspace tokens in `app/globals.css`.

7. Implement compressed export as a ZIP.
   - Install `fflate`.
   - `format=zip` returns `schema.json`, `responses.json`, and `responses.csv`.
   - The route keeps existing `json`, `csv`, and `schema` formats.

8. Keep direct in-app AI generation hidden from the main flow.
   - Do not delete `app/api/ai/generate-schema/route.ts` or `components/ai/SchemaGeneratorForm.tsx`.
   - Do not render `SchemaGeneratorForm` from the new workspace or wizard.

---

## File Structure

Create:

- `auth.ts` - Auth.js configuration, providers, adapter, session callbacks.
- `app/api/auth/[...nextauth]/route.ts` - Auth route handlers.
- `lib/auth/currentUser.ts` - authenticated publisher helpers and test bypass.
- `lib/auth/ownership.ts` - survey ownership helpers.
- `lib/rate-limit/memoryRateLimiter.ts` - in-memory rate limit utility.
- `lib/profile/profileService.ts` - profile read/update service.
- `lib/surveys/surveyListService.ts` - workspace survey list query.
- `lib/wizard/creationDraftService.ts` - creation draft persistence and finalization.
- `lib/wizard/promptTemplate.ts` - external AI prompt template generation.
- `lib/wizard/validationSummary.ts` - schema summary calculation for review UI.
- `lib/export/zipExporter.ts` - compressed export package builder.
- `components/app/AppShell.tsx` - authenticated app shell.
- `components/app/SidebarNav.tsx` - workspace navigation.
- `components/ui/Button.tsx` - button primitive.
- `components/ui/Panel.tsx` - panel primitive.
- `components/ui/StatusBadge.tsx` - status badge primitive.
- `components/ui/CopyButton.tsx` - clipboard button.
- `components/ui/Stepper.tsx` - wizard stepper.
- `components/workspace/SurveyList.tsx` - workspace survey list.
- `components/profile/PublisherProfileForm.tsx` - profile form.
- `components/settings/SettingsPanels.tsx` - settings content.
- `components/wizard/CreationWizard.tsx` - client wizard orchestrator.
- `components/wizard/DescribeStep.tsx` - wizard describe inputs.
- `components/wizard/PromptStep.tsx` - prompt template display and copy.
- `components/wizard/ImportStep.tsx` - schema paste and auto validation UI.
- `components/wizard/ReviewStep.tsx` - summary, validation, preview.
- `components/wizard/PublishStep.tsx` - publish and URL display.
- `app/(publisher)/layout.tsx` - authenticated publisher layout.
- `app/(publisher)/workspace/page.tsx` - workspace page.
- `app/(publisher)/profile/page.tsx` - profile page.
- `app/(publisher)/settings/page.tsx` - settings page.
- `app/(publisher)/surveys/new/wizard/page.tsx` - creation wizard page.
- `app/api/creation-drafts/route.ts` - create/read latest wizard draft.
- `app/api/creation-drafts/[draftId]/route.ts` - update a wizard draft.
- `app/api/creation-drafts/[draftId]/validate/route.ts` - validate draft schema.
- `app/api/creation-drafts/[draftId]/finalize/route.ts` - create survey from valid wizard draft.
- `tests/auth/currentUser.test.ts` - test bypass and unauthorized behavior.
- `tests/profile/profileService.test.ts` - profile service behavior.
- `tests/wizard/promptTemplate.test.ts` - prompt content tests.
- `tests/wizard/validationSummary.test.ts` - summary calculation tests.
- `tests/export/zipExporter.test.ts` - ZIP contents tests.
- `tests/rate-limit/memoryRateLimiter.test.ts` - rate limiter tests.

Modify:

- `package.json` - add Auth.js and ZIP dependencies.
- `package-lock.json` - generated by npm.
- `prisma/schema.prisma` - Auth.js models, roles, profile, creation drafts.
- `lib/persistence/repositories.ts` - ownership-aware repository helpers.
- `app/globals.css` - blue workspace tokens and base focus styles.
- `app/page.tsx` - unauthenticated homepage with sign-in actions.
- `app/layout.tsx` - root metadata and body shell cleanup.
- `app/surveys/[surveyId]/page.tsx` - move or replace with authenticated maintenance route.
- `app/api/surveys/route.ts` - remove default user and require publisher.
- `app/api/surveys/[surveyId]/draft/route.ts` - require owner.
- `app/api/surveys/[surveyId]/validate/route.ts` - require owner when reading stored draft.
- `app/api/surveys/[surveyId]/publish/route.ts` - require owner.
- `app/api/surveys/[surveyId]/metrics/route.ts` - require owner.
- `app/api/surveys/[surveyId]/exports/route.ts` - require owner and add `zip`.
- `components/survey/SchemaEditor.tsx` - support auto validation UI pattern.
- `components/survey/SurveyPreview.tsx` - label preview mode as not recorded.
- `components/export/ExportButtons.tsx` - add compressed export action.
- `tests/e2e/mvp-flow.spec.ts` - use auth test bypass and wizard route.

---

## Task 1: Install Dependencies and Update Prisma Schema

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install runtime dependencies**

Run:

```bash
npm install next-auth@beta @auth/prisma-adapter fflate
```

Expected: `package.json` contains `next-auth`, `@auth/prisma-adapter`, and `fflate` under `dependencies`.

- [ ] **Step 2: Replace Prisma auth/user area with Auth.js-compatible models**

Modify `prisma/schema.prisma` so the model area begins with this structure. Preserve the existing survey/runtime models after `SurveyCreationDraft`.

```prisma
enum UserRole {
  publisher
  respondent
}

model User {
  id              String                @id @default(cuid())
  name            String?
  email           String                @unique
  emailVerified   DateTime?
  image           String?
  role            UserRole              @default(publisher)
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  accounts        Account[]
  sessions        Session[]
  publisherProfile PublisherProfile?
  surveys         Survey[]
  creationDrafts  SurveyCreationDraft[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model PublisherProfile {
  id                  String   @id @default(cuid())
  userId              String   @unique
  displayName         String?
  industry            String?
  researchField       String?
  organization        String?
  intendedUse         String?
  region              String?
  onboardingCompleted Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SurveyCreationDraft {
  id                  String   @id @default(cuid())
  ownerId             String
  title               String?
  description         String?
  researchGoal        String?
  questionDescription String?
  constraints         String?
  schema              Json?
  createdSurveyId     String?  @unique
  status              String   @default("draft")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  owner               User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdSurvey       Survey?  @relation(fields: [createdSurveyId], references: [id])
}
```

- [ ] **Step 3: Add back relation from `Survey` to `SurveyCreationDraft`**

In the existing `Survey` model, add:

```prisma
creationDraft SurveyCreationDraft?
```

Keep existing `owner`, `drafts`, and `versions` relations.

- [ ] **Step 4: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: command exits with code 0 and Prisma Client is generated.

- [ ] **Step 5: Push schema in local dev database when `DATABASE_URL` is available**

Run:

```bash
npx prisma db push
```

Expected: command exits with code 0 in environments with `DATABASE_URL`.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json package-lock.json prisma/schema.prisma
git commit -m "feat: add auth and publisher profile schema"
```

Expected: commit contains only dependency lockfiles and Prisma schema changes.

---

## Task 2: Add Auth.js Configuration and Current User Boundary

**Files:**

- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/auth/currentUser.ts`
- Create: `tests/auth/currentUser.test.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Create Auth.js root config**

Create `auth.ts`:

```ts
import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import { UserRole } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/persistence/repositories";

const providers = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : []),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
    ? [
        Apple({
          clientId: process.env.AUTH_APPLE_ID,
          clientSecret: process.env.AUTH_APPLE_SECRET,
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/",
  },
  providers,
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const typedUser = user as typeof user & { role?: UserRole };
        session.user.id = user.id;
        session.user.role = typedUser.role ?? UserRole.publisher;
      }

      return session;
    },
  },
});
```

- [ ] **Step 2: Add Auth.js route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Add NextAuth session type augmentation**

Create `types/next-auth.d.ts`:

```ts
import type { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
```

If `types/` does not exist, create it before adding the file.

- [ ] **Step 4: Add current publisher helper**

Create `lib/auth/currentUser.ts`:

```ts
import { UserRole, type User } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/persistence/repositories";

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
  }
}

const canUseTestBypass = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.AUTH_TRUST_TEST_USER === "true" &&
  Boolean(process.env.AUTH_TEST_USER_EMAIL);

const getTestUser = async () => {
  if (!canUseTestBypass()) {
    return null;
  }

  return prisma.user.upsert({
    where: { email: process.env.AUTH_TEST_USER_EMAIL! },
    create: {
      email: process.env.AUTH_TEST_USER_EMAIL!,
      role: UserRole.publisher,
    },
    update: {},
  });
};

export async function getCurrentUser(): Promise<User | null> {
  const testUser = await getTestUser();

  if (testUser) {
    return testUser;
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requirePublisher(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  if (user.role !== UserRole.publisher) {
    throw new ForbiddenError();
  }

  return user;
}
```

- [ ] **Step 5: Add auth error response helper**

Create `lib/auth/http.ts`:

```ts
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
```

- [ ] **Step 6: Add focused tests for test bypass guard**

Create `tests/auth/currentUser.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    user: {
      upsert: vi.fn(async ({ create }) => ({
        id: "user_test",
        email: create.email,
        role: "publisher",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
      findUnique: vi.fn(),
    },
  },
}));

describe("getCurrentUser", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("uses test bypass outside production when explicitly trusted", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_TRUST_TEST_USER = "true";
    process.env.AUTH_TEST_USER_EMAIL = "publisher@example.com";

    const { getCurrentUser } = await import("@/lib/auth/currentUser");
    const user = await getCurrentUser();

    expect(user?.email).toBe("publisher@example.com");
    expect(user?.role).toBe("publisher");
  });

  it("does not use test bypass in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_TRUST_TEST_USER = "true";
    process.env.AUTH_TEST_USER_EMAIL = "publisher@example.com";

    const { getCurrentUser } = await import("@/lib/auth/currentUser");
    const user = await getCurrentUser();

    expect(user).toBeNull();
  });
});
```

- [ ] **Step 7: Run auth tests**

Run:

```bash
npm run test -- tests/auth/currentUser.test.ts
```

Expected: both tests pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add auth.ts app/api/auth types lib/auth tests/auth
git commit -m "feat: add publisher auth boundary"
```

Expected: commit contains auth configuration, helpers, and tests.

---

## Task 3: Add Rate Limiter and Ownership Helpers

**Files:**

- Create: `lib/rate-limit/memoryRateLimiter.ts`
- Create: `lib/auth/ownership.ts`
- Create: `tests/rate-limit/memoryRateLimiter.test.ts`
- Modify: `lib/persistence/repositories.ts`

- [ ] **Step 1: Add in-memory rate limiter**

Create `lib/rate-limit/memoryRateLimiter.ts`:

```ts
type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: Date }
  | { ok: false; retryAfterSeconds: number; resetAt: Date };

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt: new Date(resetAt) };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      resetAt: new Date(existing.resetAt),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, resetAt: new Date(existing.resetAt) };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
```

- [ ] **Step 2: Test limiter**

Create `tests/rate-limit/memoryRateLimiter.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitBuckets } from "@/lib/rate-limit/memoryRateLimiter";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearRateLimitBuckets();
  });

  it("allows requests until the limit is reached", () => {
    expect(checkRateLimit("user_1:create", 2, 60_000, 1_000).ok).toBe(true);
    expect(checkRateLimit("user_1:create", 2, 60_000, 2_000).ok).toBe(true);
    expect(checkRateLimit("user_1:create", 2, 60_000, 3_000).ok).toBe(false);
  });

  it("resets after the window expires", () => {
    expect(checkRateLimit("user_1:create", 1, 60_000, 1_000).ok).toBe(true);
    expect(checkRateLimit("user_1:create", 1, 60_000, 2_000).ok).toBe(false);
    expect(checkRateLimit("user_1:create", 1, 60_000, 62_000).ok).toBe(true);
  });
});
```

- [ ] **Step 3: Add ownership helper**

Create `lib/auth/ownership.ts`:

```ts
import { ForbiddenError } from "@/lib/auth/currentUser";
import { prisma } from "@/lib/persistence/repositories";

export async function requireOwnedSurvey(userId: string, surveyId: string) {
  const survey = await prisma.survey.findFirst({
    where: {
      id: surveyId,
      ownerId: userId,
    },
  });

  if (!survey) {
    throw new ForbiddenError();
  }

  return survey;
}
```

- [ ] **Step 4: Add ownership-aware repository helpers**

In `lib/persistence/repositories.ts`, add these functions after `getSurveyDraft`:

```ts
export async function getOwnedSurveyDraft(userId: string, surveyId: string) {
  return prisma.surveyDraft.findFirst({
    where: {
      surveyId,
      survey: {
        ownerId: userId,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listSurveysForOwner(ownerId: string) {
  return prisma.survey.findMany({
    where: { ownerId },
    include: {
      drafts: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
```

- [ ] **Step 5: Run limiter tests**

Run:

```bash
npm run test -- tests/rate-limit/memoryRateLimiter.test.ts
```

Expected: tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/rate-limit lib/auth/ownership.ts lib/persistence/repositories.ts tests/rate-limit
git commit -m "feat: add rate limiting and survey ownership helpers"
```

Expected: commit contains limiter, ownership helper, repository helper, and tests.

---

## Task 4: Add UI Primitives and Blue Workspace Styling

**Files:**

- Modify: `app/globals.css`
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Panel.tsx`
- Create: `components/ui/StatusBadge.tsx`
- Create: `components/ui/CopyButton.tsx`
- Create: `components/ui/Stepper.tsx`

- [ ] **Step 1: Add design tokens to globals**

Append to `app/globals.css`:

```css
:root {
  --hs-primary: #2563eb;
  --hs-primary-deep: #1d4ed8;
  --hs-soft-blue: #eff6ff;
  --hs-page: #f8fafc;
  --hs-surface: #ffffff;
  --hs-border: #e2e8f0;
  --hs-text: #111827;
  --hs-muted: #64748b;
  --hs-success: #059669;
  --hs-warning: #d97706;
  --hs-error: #dc2626;
}

body {
  background: var(--hs-page);
  color: var(--hs-text);
}

:focus-visible {
  outline: 2px solid var(--hs-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add button primitive**

Create `components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-blue-50 hover:text-blue-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const base = "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; children: ReactNode }) {
  return (
    <Link className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
```

- [ ] **Step 3: Add panel primitive**

Create `components/ui/Panel.tsx`:

```tsx
import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>{children}</section>;
}
```

- [ ] **Step 4: Add status badge primitive**

Create `components/ui/StatusBadge.tsx`:

```tsx
type Tone = "draft" | "published" | "success" | "warning" | "error" | "neutral";

const tones: Record<Tone, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-50 text-emerald-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  neutral: "bg-blue-50 text-blue-700",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
```

- [ ] **Step 5: Add copy button**

Create `components/ui/CopyButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button variant="secondary" onClick={copy} type="button">
      {copied ? "Copied" : label}
    </Button>
  );
}
```

- [ ] **Step 6: Add stepper**

Create `components/ui/Stepper.tsx`:

```tsx
type Step = {
  id: string;
  label: string;
};

export function Stepper({ steps, currentStepId }: { steps: Step[]; currentStepId: string }) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStepId;
        const isComplete = index < currentIndex;

        return (
          <li
            key={step.id}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              isCurrent
                ? "bg-blue-600 text-white"
                : isComplete
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 7: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes, or only reports pre-existing files not touched by this task.

- [ ] **Step 8: Commit**

Run:

```bash
git add app/globals.css components/ui
git commit -m "feat: add blue workspace UI primitives"
```

Expected: commit contains styling tokens and UI primitives.

---

## Task 5: Add Publisher App Shell, Homepage Sign-In, Profile, and Settings

**Files:**

- Create: `components/app/AppShell.tsx`
- Create: `components/app/SidebarNav.tsx`
- Create: `components/profile/PublisherProfileForm.tsx`
- Create: `components/settings/SettingsPanels.tsx`
- Create: `lib/profile/profileService.ts`
- Create: `tests/profile/profileService.test.ts`
- Create: `app/(publisher)/layout.tsx`
- Create: `app/(publisher)/profile/page.tsx`
- Create: `app/(publisher)/settings/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add profile service**

Create `lib/profile/profileService.ts`:

```ts
import { prisma } from "@/lib/persistence/repositories";

export type PublisherProfileInput = {
  displayName?: string;
  industry?: string;
  researchField?: string;
  organization?: string;
  intendedUse?: string;
  region?: string;
};

export async function getPublisherProfile(userId: string) {
  return prisma.publisherProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updatePublisherProfile(userId: string, input: PublisherProfileInput) {
  return prisma.publisherProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...input,
      onboardingCompleted: true,
    },
    update: {
      ...input,
      onboardingCompleted: true,
    },
  });
}
```

- [ ] **Step 2: Test profile service with mocked Prisma**

Create `tests/profile/profileService.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async (args) => args);

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    publisherProfile: {
      upsert,
    },
  },
}));

describe("profileService", () => {
  it("creates an empty profile when none exists", async () => {
    const { getPublisherProfile } = await import("@/lib/profile/profileService");
    await getPublisherProfile("user_1");

    expect(upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: { userId: "user_1" },
      update: {},
    });
  });

  it("marks onboarding complete when updating profile", async () => {
    const { updatePublisherProfile } = await import("@/lib/profile/profileService");
    await updatePublisherProfile("user_1", { industry: "Consumer goods" });

    expect(upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: {
        userId: "user_1",
        industry: "Consumer goods",
        onboardingCompleted: true,
      },
      update: {
        industry: "Consumer goods",
        onboardingCompleted: true,
      },
    });
  });
});
```

- [ ] **Step 3: Add sidebar nav**

Create `components/app/SidebarNav.tsx`:

```tsx
import Link from "next/link";

const items = [
  { href: "/workspace", label: "Surveys" },
  { href: "/surveys/new/wizard", label: "New Survey" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export function SidebarNav() {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Add app shell**

Create `components/app/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { SidebarNav } from "@/components/app/SidebarNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-6 text-lg font-semibold text-blue-700">Researvo</div>
          <SidebarNav />
        </aside>
        <main className="min-w-0 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add authenticated publisher layout**

Create `app/(publisher)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function PublisherLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 6: Add profile form component**

Create `components/profile/PublisherProfileForm.tsx`:

```tsx
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { updatePublisherProfile } from "@/lib/profile/profileService";

type Profile = {
  displayName: string | null;
  industry: string | null;
  researchField: string | null;
  organization: string | null;
  intendedUse: string | null;
  region: string | null;
};

export function PublisherProfileForm({ userId, profile }: { userId: string; profile: Profile }) {
  async function saveProfile(formData: FormData) {
    "use server";

    await updatePublisherProfile(userId, {
      displayName: String(formData.get("displayName") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      researchField: String(formData.get("researchField") ?? ""),
      organization: String(formData.get("organization") ?? ""),
      intendedUse: String(formData.get("intendedUse") ?? ""),
      region: String(formData.get("region") ?? ""),
    });
  }

  return (
    <Panel>
      <form action={saveProfile} className="grid gap-4">
        {[
          ["displayName", "Display name", profile.displayName],
          ["industry", "Industry", profile.industry],
          ["researchField", "Research field", profile.researchField],
          ["organization", "Organization or school", profile.organization],
          ["intendedUse", "Intended use", profile.intendedUse],
          ["region", "Region", profile.region],
        ].map(([name, label, value]) => (
          <label key={name} className="grid gap-1 text-sm font-medium text-slate-700">
            {label}
            <input name={name} defaultValue={value ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" />
          </label>
        ))}
        <Button type="submit" className="w-fit">
          Save profile
        </Button>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 7: Add profile page**

Create `app/(publisher)/profile/page.tsx`:

```tsx
import { PublisherProfileForm } from "@/components/profile/PublisherProfileForm";
import { requirePublisher } from "@/lib/auth/currentUser";
import { getPublisherProfile } from "@/lib/profile/profileService";

export default async function ProfilePage() {
  const user = await requirePublisher();
  const profile = await getPublisherProfile(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Publisher profile</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Profile</h1>
      </div>
      <PublisherProfileForm userId={user.id} profile={profile} />
    </div>
  );
}
```

- [ ] **Step 8: Add settings panels**

Create `components/settings/SettingsPanels.tsx`:

```tsx
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function SettingsPanels() {
  return (
    <div className="grid gap-4">
      <Panel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">AI providers</h2>
            <p className="mt-1 text-sm text-slate-600">External AI prompt workflow is active. In-app API key execution is not enabled in this release.</p>
          </div>
          <StatusBadge tone="neutral">Coming later</StatusBadge>
        </div>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold text-slate-950">Security</h2>
        <p className="mt-1 text-sm text-slate-600">Publisher access uses OAuth sign-in and server-side rate limits for creation actions.</p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 9: Add settings page**

Create `app/(publisher)/settings/page.tsx`:

```tsx
import { SettingsPanels } from "@/components/settings/SettingsPanels";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Application settings</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Settings</h1>
      </div>
      <SettingsPanels />
    </div>
  );
}
```

- [ ] **Step 10: Replace public homepage**

Replace `app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/workspace");
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/workspace" });
  }

  async function signInWithApple() {
    "use server";
    await signIn("apple", { redirectTo: "/workspace" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Researvo</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-slate-950">Schema-first research surveys for analysis-ready human data.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
        Create, validate, publish, collect, and export research-grade survey data from a stable schema.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <form action={signInWithGoogle}>
          <Button type="submit">Continue with Google</Button>
        </form>
        <form action={signInWithApple}>
          <Button type="submit" variant="secondary">Continue with Apple</Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 11: Run profile tests**

Run:

```bash
npm run test -- tests/profile/profileService.test.ts
```

Expected: profile service tests pass.

- [ ] **Step 12: Commit**

Run:

```bash
git add app components/app components/profile components/settings lib/profile tests/profile
git commit -m "feat: add publisher shell profile and settings"
```

Expected: commit contains shell, homepage, profile, settings, and profile tests.

---

## Task 6: Add Workspace Survey List

**Files:**

- Create: `lib/surveys/surveyListService.ts`
- Create: `components/workspace/SurveyList.tsx`
- Create: `app/(publisher)/workspace/page.tsx`

- [ ] **Step 1: Add survey list service**

Create `lib/surveys/surveyListService.ts`:

```ts
import { listSurveysForOwner } from "@/lib/persistence/repositories";

export async function getWorkspaceSurveys(ownerId: string) {
  const surveys = await listSurveysForOwner(ownerId);

  return surveys.map((survey) => {
    const latestVersion = survey.versions[0] ?? null;

    return {
      id: survey.id,
      title: survey.title,
      updatedAt: survey.updatedAt,
      status: latestVersion ? "published" : "draft",
      publicUrl: latestVersion ? `/public/s/${latestVersion.publicId}` : null,
      version: latestVersion?.version ?? null,
    };
  });
}
```

- [ ] **Step 2: Add survey list component**

Create `components/workspace/SurveyList.tsx`:

```tsx
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";

type WorkspaceSurvey = {
  id: string;
  title: string;
  updatedAt: Date;
  status: string;
  publicUrl: string | null;
  version: number | null;
};

export function SurveyList({ surveys }: { surveys: WorkspaceSurvey[] }) {
  if (surveys.length === 0) {
    return (
      <Panel className="text-center">
        <h2 className="text-lg font-semibold text-slate-950">No surveys yet</h2>
        <p className="mt-1 text-sm text-slate-600">Start with a research goal and generate a schema prompt.</p>
        <LinkButton href="/surveys/new/wizard" className="mt-4">New survey</LinkButton>
      </Panel>
    );
  }

  return (
    <Panel className="p-0">
      <div className="divide-y divide-slate-200">
        {surveys.map((survey) => (
          <div key={survey.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/surveys/${survey.id}`} className="font-medium text-slate-950 hover:text-blue-700">
                  {survey.title}
                </Link>
                <StatusBadge tone={survey.status === "published" ? "published" : "draft"}>{survey.status}</StatusBadge>
              </div>
              <p className="mt-1 text-sm text-slate-500">Updated {survey.updatedAt.toLocaleDateString()}</p>
              {survey.publicUrl ? <p className="mt-1 truncate text-sm text-blue-700">{survey.publicUrl}</p> : null}
            </div>
            <LinkButton href={`/surveys/${survey.id}`} variant="secondary">Open</LinkButton>
          </div>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Add workspace page**

Create `app/(publisher)/workspace/page.tsx`:

```tsx
import { LinkButton } from "@/components/ui/Button";
import { SurveyList } from "@/components/workspace/SurveyList";
import { requirePublisher } from "@/lib/auth/currentUser";
import { getWorkspaceSurveys } from "@/lib/surveys/surveyListService";

export default async function WorkspacePage() {
  const user = await requirePublisher();
  const surveys = await getWorkspaceSurveys(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-700">Publisher workspace</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Surveys</h1>
        </div>
        <LinkButton href="/surveys/new/wizard">New survey</LinkButton>
      </div>
      <SurveyList surveys={surveys} />
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck through build**

Run:

```bash
npm run build
```

Expected: build passes, or fails only because OAuth environment variables are not configured. If provider env causes build failure, adjust `auth.ts` provider construction so missing provider credentials omit that provider without throwing during build.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/\\(publisher\\)/workspace components/workspace lib/surveys
git commit -m "feat: add publisher workspace survey list"
```

Expected: commit contains workspace route, list component, and service.

---

## Task 7: Add Creation Draft Service, Prompt Template, and Tests

**Files:**

- Create: `lib/wizard/creationDraftService.ts`
- Create: `lib/wizard/promptTemplate.ts`
- Create: `lib/wizard/validationSummary.ts`
- Create: `tests/wizard/promptTemplate.test.ts`
- Create: `tests/wizard/validationSummary.test.ts`

- [ ] **Step 1: Add creation draft service**

Create `lib/wizard/creationDraftService.ts`:

```ts
import { Prisma } from "@prisma/client";
import { createSurveyDraft, prisma } from "@/lib/persistence/repositories";
import { SurveySchemaZ, type SurveySchema } from "@/lib/schema/surveySchema";

export type CreationDraftInput = {
  title?: string;
  description?: string;
  researchGoal?: string;
  questionDescription?: string;
  constraints?: string;
  schema?: unknown;
};

export async function getOrCreateActiveCreationDraft(ownerId: string) {
  const existing = await prisma.surveyCreationDraft.findFirst({
    where: {
      ownerId,
      status: "draft",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.surveyCreationDraft.create({
    data: { ownerId },
  });
}

export async function getOwnedCreationDraft(ownerId: string, draftId: string) {
  return prisma.surveyCreationDraft.findFirst({
    where: { id: draftId, ownerId },
  });
}

export async function updateCreationDraft(ownerId: string, draftId: string, input: CreationDraftInput) {
  const existing = await getOwnedCreationDraft(ownerId, draftId);

  if (!existing) {
    return null;
  }

  const schema = input.schema === undefined ? undefined : (input.schema as Prisma.InputJsonValue);

  return prisma.surveyCreationDraft.update({
    where: { id: draftId },
    data: {
      title: input.title,
      description: input.description,
      researchGoal: input.researchGoal,
      questionDescription: input.questionDescription,
      constraints: input.constraints,
      schema,
    },
  });
}

export async function finalizeCreationDraft(ownerId: string, draftId: string) {
  const draft = await getOwnedCreationDraft(ownerId, draftId);

  if (!draft) {
    return { ok: false as const, error: "DRAFT_NOT_FOUND" };
  }

  if (draft.createdSurveyId) {
    return { ok: true as const, surveyId: draft.createdSurveyId };
  }

  const schemaResult = SurveySchemaZ.safeParse(draft.schema);

  if (!schemaResult.success) {
    return { ok: false as const, error: "INVALID_SCHEMA", issues: schemaResult.error.issues };
  }

  const schema: SurveySchema = {
    ...schemaResult.data,
    survey: {
      ...schemaResult.data.survey,
      title: draft.title || schemaResult.data.survey.title,
      description: draft.description || schemaResult.data.survey.description,
    },
  };

  const result = await createSurveyDraft({
    ownerId,
    title: schema.survey.title,
    schema,
  });

  await prisma.surveyCreationDraft.update({
    where: { id: draftId },
    data: {
      createdSurveyId: result.survey.id,
      status: "converted",
    },
  });

  return { ok: true as const, surveyId: result.survey.id };
}
```

- [ ] **Step 2: Add prompt template generator**

Create `lib/wizard/promptTemplate.ts`:

```ts
export type PromptTemplateInput = {
  title?: string | null;
  description?: string | null;
  researchGoal?: string | null;
  questionDescription?: string | null;
  constraints?: string | null;
};

export function buildExternalSchemaPrompt(input: PromptTemplateInput) {
  return [
    "You are helping create a Researvo research survey schema.",
    "Return only valid JSON. Do not wrap it in Markdown fences.",
    "",
    "Survey context:",
    `Title: ${input.title || "Untitled survey"}`,
    `Description: ${input.description || "No description provided"}`,
    `Research goal: ${input.researchGoal || "No research goal provided"}`,
    `Question description: ${input.questionDescription || "No question description provided"}`,
    `Constraints: ${input.constraints || "No constraints provided"}`,
    "",
    "Schema requirements:",
    "- schemaVersion must be \"0.0.1\".",
    "- Include survey metadata with id, title, description, language, and entryNodeId.",
    "- Include policy with accessMode \"anonymous\".",
    "- Include consent when the survey collects sensitive or research-purpose data.",
    "- Include nodes, variables, and edges.",
    "- Every question node with analysis value must have a stable variableName.",
    "- Closed choice options must have stable coded values.",
    "- Branch targets must reference existing node ids.",
    "- Terminal flow must end at a terminal node.",
    "",
    "Output:",
    "Return one complete JSON object that conforms to the Researvo schema.",
  ].join("\n");
}
```

- [ ] **Step 3: Add validation summary helper**

Create `lib/wizard/validationSummary.ts`:

```ts
import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";

export function summarizeSchema(schema: SurveySchema, report: ValidationReport | null) {
  return {
    questionCount: schema.nodes.filter((node) => node.type !== "terminal" && node.type !== "consent").length,
    variableCount: schema.variables.length,
    branchCount: schema.nodes.reduce((count, node) => count + (node.branches?.length ?? 0), 0),
    errorCount: report?.findings.filter((finding) => finding.level === "error").length ?? 0,
    warningCount: report?.findings.filter((finding) => finding.level === "warning").length ?? 0,
    suggestionCount: report?.findings.filter((finding) => finding.level === "suggestion").length ?? 0,
  };
}
```

- [ ] **Step 4: Test prompt content**

Create `tests/wizard/promptTemplate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildExternalSchemaPrompt } from "@/lib/wizard/promptTemplate";

describe("buildExternalSchemaPrompt", () => {
  it("includes user research context and Researvo schema constraints", () => {
    const prompt = buildExternalSchemaPrompt({
      title: "Consumer behavior",
      researchGoal: "Measure snack purchase motivation",
      questionDescription: "Ask about age, purchase frequency, and brand preference",
    });

    expect(prompt).toContain("Consumer behavior");
    expect(prompt).toContain("Measure snack purchase motivation");
    expect(prompt).toContain("schemaVersion must be \"0.0.1\"");
    expect(prompt).toContain("Return only valid JSON");
  });
});
```

- [ ] **Step 5: Test summary helper**

Create `tests/wizard/validationSummary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { summarizeSchema } from "@/lib/wizard/validationSummary";

describe("summarizeSchema", () => {
  it("counts questions, variables, branches, and validation findings", () => {
    const summary = summarizeSchema(exampleSurveySchema, {
      hasBlockingErrors: true,
      findings: [
        { level: "error", code: "E", message: "Error" },
        { level: "warning", code: "W", message: "Warning" },
        { level: "suggestion", code: "S", message: "Suggestion" },
      ],
    });

    expect(summary.variableCount).toBe(exampleSurveySchema.variables.length);
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(1);
    expect(summary.suggestionCount).toBe(1);
  });
});
```

- [ ] **Step 6: Run wizard unit tests**

Run:

```bash
npm run test -- tests/wizard/promptTemplate.test.ts tests/wizard/validationSummary.test.ts
```

Expected: wizard tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/wizard tests/wizard
git commit -m "feat: add survey creation wizard services"
```

Expected: commit contains creation draft, prompt, summary helpers, and tests.

---

## Task 8: Add Creation Draft API Routes

**Files:**

- Create: `app/api/creation-drafts/route.ts`
- Create: `app/api/creation-drafts/[draftId]/route.ts`
- Create: `app/api/creation-drafts/[draftId]/validate/route.ts`
- Create: `app/api/creation-drafts/[draftId]/finalize/route.ts`

- [ ] **Step 1: Add create/read latest route**

Create `app/api/creation-drafts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requirePublisher } from "@/lib/auth/currentUser";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { getOrCreateActiveCreationDraft } from "@/lib/wizard/creationDraftService";

export async function GET() {
  try {
    const user = await requirePublisher();
    const draft = await getOrCreateActiveCreationDraft(user.id);
    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requirePublisher();
    const limit = checkRateLimit(`creation-draft:${user.id}`, 10, 60 * 60 * 1000);

    if (!limit.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });
    }

    const draft = await getOrCreateActiveCreationDraft(user.id);
    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_CREATE_FAILED" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add update route**

Create `app/api/creation-drafts/[draftId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requirePublisher } from "@/lib/auth/currentUser";
import { updateCreationDraft } from "@/lib/wizard/creationDraftService";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const { draftId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const draft = await updateCreationDraft(user.id, draftId, {
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      researchGoal: typeof body.researchGoal === "string" ? body.researchGoal : undefined,
      questionDescription: typeof body.questionDescription === "string" ? body.questionDescription : undefined,
      constraints: typeof body.constraints === "string" ? body.constraints : undefined,
      schema: body.schema,
    });

    if (!draft) {
      return NextResponse.json({ error: "DRAFT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_UPDATE_FAILED" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Add validation route**

Create `app/api/creation-drafts/[draftId]/validate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requirePublisher } from "@/lib/auth/currentUser";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";
import { summarizeSchema } from "@/lib/wizard/validationSummary";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, _context: RouteContext) {
  try {
    await requirePublisher();
    const body = (await request.json().catch(() => ({}))) as { schema?: unknown };
    const schemaResult = SurveySchemaZ.safeParse(body.schema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    const validationReport = validateSurveySchema(schemaResult.data);
    return NextResponse.json({
      validationReport,
      summary: summarizeSchema(schemaResult.data, validationReport),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add finalize route**

Create `app/api/creation-drafts/[draftId]/finalize/route.ts`:

```ts
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requirePublisher } from "@/lib/auth/currentUser";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { finalizeCreationDraft } from "@/lib/wizard/creationDraftService";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requirePublisher();
    const limit = checkRateLimit(`finalize:${user.id}`, 20, 60 * 60 * 1000);

    if (!limit.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });
    }

    const { draftId } = await context.params;
    const result = await finalizeCreationDraft(user.id, draftId);

    if (!result.ok) {
      return NextResponse.json(result, { status: result.error === "DRAFT_NOT_FOUND" ? 404 : 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "FINALIZE_FAILED" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add app/api/creation-drafts
git commit -m "feat: add creation draft API"
```

Expected: commit contains creation draft API routes.

---

## Task 9: Add Full-Page Creation Wizard

**Files:**

- Create: `components/wizard/CreationWizard.tsx`
- Create: `components/wizard/DescribeStep.tsx`
- Create: `components/wizard/PromptStep.tsx`
- Create: `components/wizard/ImportStep.tsx`
- Create: `components/wizard/ReviewStep.tsx`
- Create: `components/wizard/PublishStep.tsx`
- Create: `app/(publisher)/surveys/new/wizard/page.tsx`

- [ ] **Step 1: Add wizard page**

Create `app/(publisher)/surveys/new/wizard/page.tsx`:

```tsx
import { CreationWizard } from "@/components/wizard/CreationWizard";
import { requirePublisher } from "@/lib/auth/currentUser";
import { getOrCreateActiveCreationDraft } from "@/lib/wizard/creationDraftService";

export default async function NewSurveyWizardPage() {
  const user = await requirePublisher();
  const draft = await getOrCreateActiveCreationDraft(user.id);

  return <CreationWizard initialDraft={draft} />;
}
```

- [ ] **Step 2: Add describe step**

Create `components/wizard/DescribeStep.tsx`:

```tsx
"use client";

type DescribeValue = {
  title: string;
  description: string;
  researchGoal: string;
  questionDescription: string;
  constraints: string;
};

export function DescribeStep({ value, onChange }: { value: DescribeValue; onChange: (value: DescribeValue) => void }) {
  const update = (key: keyof DescribeValue, next: string) => onChange({ ...value, [key]: next });

  return (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Survey title
        <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={value.title} onChange={(event) => update("title", event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Short description
        <textarea className="min-h-24 rounded-md border border-slate-300 p-3 text-sm" value={value.description} onChange={(event) => update("description", event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Research goal
        <textarea className="min-h-24 rounded-md border border-slate-300 p-3 text-sm" value={value.researchGoal} onChange={(event) => update("researchGoal", event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Question description
        <textarea className="min-h-32 rounded-md border border-slate-300 p-3 text-sm" value={value.questionDescription} onChange={(event) => update("questionDescription", event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Constraints
        <textarea className="min-h-20 rounded-md border border-slate-300 p-3 text-sm" value={value.constraints} onChange={(event) => update("constraints", event.target.value)} />
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Add prompt step**

Create `components/wizard/PromptStep.tsx`:

```tsx
"use client";

import { CopyButton } from "@/components/ui/CopyButton";

export function PromptStep({ prompt }: { prompt: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CopyButton value={prompt} label="Copy prompt" />
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-md border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-50">{prompt}</pre>
    </div>
  );
}
```

- [ ] **Step 4: Add import step**

Create `components/wizard/ImportStep.tsx`:

```tsx
"use client";

import type { ValidationReport } from "@/lib/validation/types";
import { ValidationReportPanel } from "@/components/validation/ValidationReportPanel";

export function ImportStep({
  schemaText,
  parseError,
  validationReport,
  onChange,
}: {
  schemaText: string;
  parseError: string | null;
  validationReport: ValidationReport | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <textarea
          className="h-[520px] w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900"
          value={schemaText}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
        {parseError ? <p className="mt-2 text-sm text-red-600">{parseError}</p> : null}
      </div>
      <ValidationReportPanel report={validationReport} />
    </div>
  );
}
```

- [ ] **Step 5: Add review step**

Create `components/wizard/ReviewStep.tsx`:

```tsx
"use client";

import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SurveyPreview } from "@/components/survey/SurveyPreview";
import { ValidationReportPanel } from "@/components/validation/ValidationReportPanel";

export function ReviewStep({
  schema,
  schemaText,
  validationReport,
}: {
  schema: SurveySchema | null;
  schemaText: string;
  validationReport: ValidationReport | null;
}) {
  const errorCount = validationReport?.findings.filter((finding) => finding.level === "error").length ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">Schema summary</h3>
            <StatusBadge tone={errorCount > 0 ? "error" : "success"}>{errorCount > 0 ? "Blocked" : "Ready"}</StatusBadge>
          </div>
          {schema ? (
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-slate-500">Questions</dt><dd className="font-semibold text-slate-950">{schema.nodes.length}</dd></div>
              <div><dt className="text-slate-500">Variables</dt><dd className="font-semibold text-slate-950">{schema.variables.length}</dd></div>
              <div><dt className="text-slate-500">Edges</dt><dd className="font-semibold text-slate-950">{schema.edges.length}</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Paste valid schema JSON to review the survey.</p>
          )}
        </Panel>
        <ValidationReportPanel report={validationReport} />
      </div>
      <Panel>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Preview mode, not recorded</p>
        <SurveyPreview schemaText={schemaText} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 6: Add publish step**

Create `components/wizard/PublishStep.tsx`:

```tsx
"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";

export function PublishStep({
  canPublish,
  publicUrl,
  isPublishing,
  onPublish,
}: {
  canPublish: boolean;
  publicUrl: string | null;
  isPublishing: boolean;
  onPublish: () => void;
}) {
  return (
    <Panel>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Publish frozen survey version</h3>
          <p className="mt-1 text-sm text-slate-600">Publishing binds the public URL to this validated schema version.</p>
        </div>
        <Button type="button" disabled={!canPublish || isPublishing} onClick={onPublish}>
          {isPublishing ? "Publishing..." : "Publish survey"}
        </Button>
        {publicUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-blue-50 p-3">
            <a href={publicUrl} className="text-sm font-medium text-blue-700">{publicUrl}</a>
            <CopyButton value={publicUrl} label="Copy URL" />
            <LinkButton href={publicUrl} variant="secondary">Open</LinkButton>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 7: Add wizard orchestrator**

Create `components/wizard/CreationWizard.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SurveyCreationDraft } from "@prisma/client";
import { SurveySchemaZ, type SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationReport } from "@/lib/validation/types";
import { buildExternalSchemaPrompt } from "@/lib/wizard/promptTemplate";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Stepper } from "@/components/ui/Stepper";
import { DescribeStep } from "@/components/wizard/DescribeStep";
import { ImportStep } from "@/components/wizard/ImportStep";
import { PromptStep } from "@/components/wizard/PromptStep";
import { PublishStep } from "@/components/wizard/PublishStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";

const steps = [
  { id: "describe", label: "Describe" },
  { id: "prompt", label: "Prompt" },
  { id: "import", label: "Import" },
  { id: "review", label: "Review" },
  { id: "publish", label: "Publish" },
];

export function CreationWizard({ initialDraft }: { initialDraft: SurveyCreationDraft }) {
  const [currentStep, setCurrentStep] = useState("describe");
  const [draft, setDraft] = useState({
    title: initialDraft.title ?? "",
    description: initialDraft.description ?? "",
    researchGoal: initialDraft.researchGoal ?? "",
    questionDescription: initialDraft.questionDescription ?? "",
    constraints: initialDraft.constraints ?? "",
  });
  const [schemaText, setSchemaText] = useState(initialDraft.schema ? JSON.stringify(initialDraft.schema, null, 2) : "");
  const [parseError, setParseError] = useState<string | null>(null);
  const [schema, setSchema] = useState<SurveySchema | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [surveyId, setSurveyId] = useState(initialDraft.createdSurveyId);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const prompt = useMemo(() => buildExternalSchemaPrompt(draft), [draft]);
  const hasBlockingErrors = validationReport?.findings.some((finding) => finding.level === "error") ?? true;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetch(`/api/creation-drafts/${initialDraft.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
    }, 600);

    return () => window.clearTimeout(handle);
  }, [draft, initialDraft.id]);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      if (!schemaText.trim()) {
        setParseError(null);
        setSchema(null);
        setValidationReport(null);
        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(schemaText);
        setParseError(null);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Invalid JSON");
        setSchema(null);
        setValidationReport(null);
        return;
      }

      const schemaResult = SurveySchemaZ.safeParse(parsed);

      if (!schemaResult.success) {
        setParseError("JSON parsed, but the schema does not match Researvo format.");
        setSchema(null);
        setValidationReport(null);
        return;
      }

      setSchema(schemaResult.data);
      await fetch(`/api/creation-drafts/${initialDraft.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, schema: schemaResult.data }),
      });

      const response = await fetch(`/api/creation-drafts/${initialDraft.id}/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schema: schemaResult.data }),
      });
      const payload = (await response.json()) as { validationReport?: ValidationReport };
      setValidationReport(payload.validationReport ?? null);
    }, 700);

    return () => window.clearTimeout(handle);
  }, [draft, initialDraft.id, schemaText]);

  const finalizeIfNeeded = async () => {
    if (surveyId) {
      return surveyId;
    }

    const response = await fetch(`/api/creation-drafts/${initialDraft.id}/finalize`, { method: "POST" });
    const payload = (await response.json()) as { surveyId?: string };

    if (!response.ok || !payload.surveyId) {
      return null;
    }

    setSurveyId(payload.surveyId);
    return payload.surveyId;
  };

  const publish = async () => {
    setIsPublishing(true);
    const nextSurveyId = await finalizeIfNeeded();

    if (!nextSurveyId) {
      setIsPublishing(false);
      return;
    }

    const response = await fetch(`/api/surveys/${nextSurveyId}/publish`, { method: "POST" });
    const payload = (await response.json()) as { publicUrl?: string; validationReport?: ValidationReport };
    setValidationReport(payload.validationReport ?? validationReport);
    setPublicUrl(payload.publicUrl ?? null);
    setIsPublishing(false);
  };

  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const nextStep = () => setCurrentStep(steps[Math.min(currentIndex + 1, steps.length - 1)].id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-700">New survey</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-950">Creation wizard</h1>
      </div>
      <Stepper steps={steps} currentStepId={currentStep} />
      <Panel>
        {currentStep === "describe" ? <DescribeStep value={draft} onChange={setDraft} /> : null}
        {currentStep === "prompt" ? <PromptStep prompt={prompt} /> : null}
        {currentStep === "import" ? <ImportStep schemaText={schemaText} parseError={parseError} validationReport={validationReport} onChange={setSchemaText} /> : null}
        {currentStep === "review" ? <ReviewStep schema={schema} schemaText={schemaText} validationReport={validationReport} /> : null}
        {currentStep === "publish" ? <PublishStep canPublish={Boolean(schema) && !hasBlockingErrors} publicUrl={publicUrl} isPublishing={isPublishing} onPublish={publish} /> : null}
      </Panel>
      <div className="flex justify-end">
        <Button type="button" onClick={nextStep} disabled={currentStep === "publish"}>
          Next
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 9: Commit**

Run:

```bash
git add app/\\(publisher\\)/surveys/new/wizard components/wizard
git commit -m "feat: add survey creation wizard UI"
```

Expected: commit contains the wizard route and components.

---

## Task 10: Protect Survey APIs and Remove Default Local User

**Files:**

- Modify: `app/api/surveys/route.ts`
- Modify: `app/api/surveys/[surveyId]/draft/route.ts`
- Modify: `app/api/surveys/[surveyId]/validate/route.ts`
- Modify: `app/api/surveys/[surveyId]/publish/route.ts`
- Modify: `app/api/surveys/[surveyId]/metrics/route.ts`
- Modify: `app/api/surveys/[surveyId]/exports/route.ts`

- [ ] **Step 1: Replace survey create API with authenticated owner**

Replace `app/api/surveys/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requirePublisher } from "@/lib/auth/currentUser";
import { createSurveyDraft } from "@/lib/persistence/repositories";
import { checkRateLimit } from "@/lib/rate-limit/memoryRateLimiter";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

export async function POST(request: Request) {
  try {
    const user = await requirePublisher();
    const limit = checkRateLimit(`survey-create:${user.id}`, 20, 60 * 60 * 1000);

    if (!limit.ok) {
      return NextResponse.json({ error: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      schema?: unknown;
    };

    const schemaResult = SurveySchemaZ.safeParse(body.schema ?? exampleSurveySchema);

    if (!schemaResult.success) {
      return NextResponse.json({ error: "INVALID_SCHEMA", issues: schemaResult.error.issues }, { status: 400 });
    }

    const { survey, draft } = await createSurveyDraft({
      ownerId: user.id,
      title: body.title ?? schemaResult.data.survey.title,
      schema: schemaResult.data,
    });

    return NextResponse.json({ survey, draft });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "SURVEY_CREATE_FAILED" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Protect draft route**

At the top of `app/api/surveys/[surveyId]/draft/route.ts`, add imports:

```ts
import { authErrorResponse } from "@/lib/auth/http";
import { requirePublisher } from "@/lib/auth/currentUser";
import { requireOwnedSurvey } from "@/lib/auth/ownership";
```

Wrap both handlers so they call:

```ts
const user = await requirePublisher();
await requireOwnedSurvey(user.id, surveyId);
```

If auth or ownership fails, return:

```ts
return authErrorResponse(error) ?? NextResponse.json({ error: "DRAFT_REQUEST_FAILED" }, { status: 500 });
```

- [ ] **Step 3: Protect validate route**

In `app/api/surveys/[surveyId]/validate/route.ts`, add the same auth imports. Before reading a stored draft, call:

```ts
const user = await requirePublisher();
await requireOwnedSurvey(user.id, surveyId);
```

Keep support for `body.schema` validation after ownership passes.

- [ ] **Step 4: Protect publish route**

In `app/api/surveys/[surveyId]/publish/route.ts`, add the same auth imports. Before `getSurveyDraft(surveyId)`, call:

```ts
const user = await requirePublisher();
await requireOwnedSurvey(user.id, surveyId);
```

Keep existing validation and version creation behavior.

- [ ] **Step 5: Protect metrics route**

In `app/api/surveys/[surveyId]/metrics/route.ts`, add the same auth imports. Before querying sessions, call:

```ts
const user = await requirePublisher();
await requireOwnedSurvey(user.id, surveyId);
```

- [ ] **Step 6: Protect exports route**

In `app/api/surveys/[surveyId]/exports/route.ts`, add the same auth imports. Before `latestVersionForSurvey(surveyId)`, call:

```ts
const user = await requirePublisher();
await requireOwnedSurvey(user.id, surveyId);
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: build passes and no route handler has an unhandled auth exception.

- [ ] **Step 8: Commit**

Run:

```bash
git add app/api/surveys
git commit -m "feat: protect publisher survey APIs"
```

Expected: commit removes default operator ownership and protects survey API routes.

---

## Task 11: Upgrade Survey Maintenance Page and Preview Labeling

**Files:**

- Create: `app/(publisher)/surveys/[surveyId]/page.tsx`
- Delete: `app/surveys/[surveyId]/page.tsx`
- Modify: `components/survey/SurveyPreview.tsx`
- Modify: `components/export/ExportButtons.tsx`

- [ ] **Step 1: Move maintenance page under publisher group**

Create `app/(publisher)/surveys/[surveyId]/page.tsx` by moving the current client behavior into a new client component or by copying the existing page and improving it. The page must keep:

```tsx
<ValidationReportPanel report={validationReport} />
<SurveyPreview schemaText={schemaText} />
<SurveyMetricsPanel metrics={metrics} onRefresh={refreshMetrics} />
<ExportButtons surveyId={surveyId} />
```

The page must remove:

```tsx
<SchemaGeneratorForm />
```

- [ ] **Step 2: Delete the old conflicting route file**

Delete:

```text
app/surveys/[surveyId]/page.tsx
```

Route groups do not change the URL path, so keeping both files would create a duplicate `/surveys/[surveyId]` route.

- [ ] **Step 3: Add automatic validation in maintenance client**

Inside the maintenance client component, add a debounced effect that parses `schemaText`, clears parse errors when parsing succeeds, and calls:

```ts
await fetch(`/api/surveys/${surveyId}/validate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ schema }),
});
```

The existing manual Validate button can be removed or converted to secondary "Recheck now".

- [ ] **Step 4: Label preview as not recorded**

In `components/survey/SurveyPreview.tsx`, wrap valid preview output with:

```tsx
<div className="space-y-4">
  <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
    Preview mode, not recorded
  </p>
  {/* existing preview content */}
</div>
```

Keep existing schema parsing behavior.

- [ ] **Step 5: Add compressed export button**

In `components/export/ExportButtons.tsx`, add a link or button for:

```tsx
href={`/api/surveys/${surveyId}/exports?format=zip`}
```

Label it:

```tsx
Download package
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: build passes and the direct AI generation form no longer appears in publisher pages.

- [ ] **Step 7: Commit**

Run:

```bash
git add app components/survey components/export
git commit -m "feat: refresh survey maintenance workflow"
```

Expected: commit contains authenticated maintenance UI, automatic validation, preview label, and export button.

---

## Task 12: Add Compressed Export Package

**Files:**

- Create: `lib/export/zipExporter.ts`
- Create: `tests/export/zipExporter.test.ts`
- Modify: `app/api/surveys/[surveyId]/exports/route.ts`

- [ ] **Step 1: Add ZIP exporter**

Create `lib/export/zipExporter.ts`:

```ts
import { zipSync, strToU8 } from "fflate";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import { exportResponsesToCsv } from "@/lib/export/csvExporter";
import { exportResponsesToJson, type ExportSubmission } from "@/lib/export/jsonExporter";

export function exportSurveyPackage({
  schema,
  submissions,
}: {
  schema: SurveySchema;
  submissions: ExportSubmission[];
}) {
  const json = exportResponsesToJson({ schema, submissions });
  const csv = exportResponsesToCsv({ schema, submissions });

  return zipSync({
    "schema.json": strToU8(JSON.stringify(schema, null, 2)),
    "responses.json": strToU8(JSON.stringify(json, null, 2)),
    "responses.csv": strToU8(csv),
  });
}
```

- [ ] **Step 2: Export `ExportSubmission` type from JSON exporter**

In `lib/export/jsonExporter.ts`, ensure the submission type is exported:

```ts
export type ExportSubmission = {
  id: string;
  surveyVersionId: string;
  submittedAt: string;
  answers: Record<string, unknown>;
};
```

Update the function signature to use this type.

- [ ] **Step 3: Add ZIP exporter test**

Create `tests/export/zipExporter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { exportSurveyPackage } from "@/lib/export/zipExporter";

describe("exportSurveyPackage", () => {
  it("contains schema, JSON responses, and CSV responses", () => {
    const zipped = exportSurveyPackage({
      schema: exampleSurveySchema,
      submissions: [
        {
          id: "submission_1",
          surveyVersionId: "version_1",
          submittedAt: "2026-01-01T00:00:00.000Z",
          answers: { gender: 1 },
        },
      ],
    });

    const files = unzipSync(zipped);

    expect(strFromU8(files["schema.json"])).toContain(exampleSurveySchema.survey.title);
    expect(strFromU8(files["responses.json"])).toContain("submission_1");
    expect(strFromU8(files["responses.csv"])).toContain("gender");
  });
});
```

- [ ] **Step 4: Add ZIP format to export route**

In `app/api/surveys/[surveyId]/exports/route.ts`, import:

```ts
import { exportSurveyPackage } from "@/lib/export/zipExporter";
```

Before the unsupported format response, add:

```ts
if (format === "zip") {
  return new NextResponse(exportSurveyPackage({ schema: schemaResult.data, submissions }), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="survey-${surveyId}-package.zip"`,
    },
  });
}
```

- [ ] **Step 5: Run export tests**

Run:

```bash
npm run test -- tests/export/jsonExporter.test.ts tests/export/csvExporter.test.ts tests/export/zipExporter.test.ts
```

Expected: all export tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/export app/api/surveys/\\[surveyId\\]/exports/route.ts tests/export
git commit -m "feat: add compressed survey export package"
```

Expected: commit contains ZIP exporter, route support, and tests.

---

## Task 13: Update E2E Flow for Authenticated Wizard

**Files:**

- Modify: `tests/e2e/mvp-flow.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Configure auth test bypass for Playwright web server**

In `playwright.config.ts`, ensure the web server command includes:

```ts
AUTH_TRUST_TEST_USER: "true",
AUTH_TEST_USER_EMAIL: "e2e-publisher@humansignal.dev",
```

If the config uses `webServer.command`, prefer:

```ts
command: "AUTH_TRUST_TEST_USER=true AUTH_TEST_USER_EMAIL=e2e-publisher@humansignal.dev npm run dev",
```

- [ ] **Step 2: Update MVP E2E to use wizard**

Replace the start of `tests/e2e/mvp-flow.spec.ts` with this flow:

```ts
await page.goto("/surveys/new/wizard");
await page.getByLabel("Survey title").fill("Example research survey");
await page.getByLabel("Short description").fill("A small survey for MVP verification.");
await page.getByLabel("Research goal").fill("Measure simple respondent demographics.");
await page.getByLabel("Question description").fill("Ask for gender and then complete the survey.");
await page.getByRole("button", { name: "Next" }).click();
await expect(page.getByText("Return only valid JSON")).toBeVisible();
await page.getByRole("button", { name: "Next" }).click();
```

Then paste the example schema into the schema textarea:

```ts
await page.locator("textarea").last().fill(JSON.stringify(exampleSurveySchema, null, 2));
await expect(page.getByText("errors (0)", { exact: false })).toBeVisible();
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("button", { name: "Next" }).click();
await page.getByRole("button", { name: "Publish survey" }).click();
```

Import `exampleSurveySchema` at the top:

```ts
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
```

- [ ] **Step 3: Keep public respondent flow unchanged**

Keep the existing public URL section:

```ts
const publicLink = page.getByRole("link", { name: /\/public\/s\/s_/ });
await expect(publicLink).toBeVisible();
const publicHref = await publicLink.getAttribute("href");
expect(publicHref).toBeTruthy();
```

Continue to navigate to `publicHref`, complete the survey, return to the operator page, refresh metrics, and check CSV export.

- [ ] **Step 4: Add ZIP assertion**

After CSV assertion, add:

```ts
const zipResponse = await request.get(`/api/surveys/${operatorSurveyId}/exports?format=zip`, {
  headers: {
    "x-auth-test-user": "e2e-publisher@humansignal.dev",
  },
});
expect(zipResponse.ok()).toBe(true);
expect(zipResponse.headers()["content-type"]).toContain("application/zip");
```

If API request auth cannot use cookies from page context, keep the route check in unit tests and omit direct request ZIP assertion from E2E.

- [ ] **Step 5: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: E2E creates through wizard, publishes, completes public response, refreshes metrics, and exports CSV.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/e2e/mvp-flow.spec.ts playwright.config.ts
git commit -m "test: update e2e for publisher wizard workflow"
```

Expected: commit contains Playwright auth bypass config and updated workflow.

---

## Task 14: Final Verification and Documentation Check

**Files:**

- Modify only if commands reveal required updates: `README.md`

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Run E2E when database is configured**

Run:

```bash
npm run test:e2e
```

Expected: Playwright tests pass when `DATABASE_URL` is configured. If `DATABASE_URL` is absent, the existing skip behavior should remain explicit.

- [ ] **Step 5: Manual browser smoke test**

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Verify:

- Public homepage renders.
- Test-authenticated `/workspace` renders when `AUTH_TRUST_TEST_USER=true` and `AUTH_TEST_USER_EMAIL` are set.
- `/surveys/new/wizard` autosaves text.
- Prompt step displays generated prompt.
- Import step validates pasted example schema automatically.
- Review preview is labeled not recorded.
- Publish produces a public URL.
- Public URL can receive an anonymous response.
- Metrics count only the public response.
- Export package downloads as ZIP.

- [ ] **Step 6: Commit docs update if README changed**

If README received setup notes, run:

```bash
git add README.md
git commit -m "docs: document publisher auth setup"
```

Expected: commit exists only when README changed.

---

## Self-Review Checklist

- Spec coverage:
  - Publisher SSO is covered in Tasks 1 and 2.
  - Publisher profile is covered in Task 5.
  - Workspace is covered in Task 6.
  - Full-page wizard is covered in Tasks 7, 8, and 9.
  - External AI prompt workflow is covered in Tasks 7 and 9.
  - Direct in-app AI UI is removed from the main flow in Task 11.
  - Automatic validation is covered in Tasks 8, 9, and 11.
  - Preview not recorded label is covered in Tasks 9 and 11.
  - Publishing frozen version reuses existing service and is covered in Tasks 9 and 10.
  - Metrics and ownership are covered in Task 10.
  - Compressed export is covered in Task 12.
  - Clean blue UI system is covered in Tasks 4, 5, 6, 9, and 11.

- Placeholder scan:
  - No placeholder tokens remain.
  - No task asks a worker to "write tests" without test code.
  - No task defers a Phase 1 requirement.

- Type consistency:
  - `SurveyCreationDraft.createdSurveyId` is used by service and wizard.
  - `requirePublisher()` returns a Prisma `User`.
  - `authErrorResponse()` handles `UnauthorizedError` and `ForbiddenError`.
  - `ExportSubmission` is shared by JSON and ZIP exporters.
