# Researvo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Researvo MVP: a schema-first research survey app that can create or import a Survey Schema V0.0.1 draft, validate it, preview it, publish an immutable version, collect anonymous responses, and export stable variable data.

**Architecture:** The implementation centers on `SurveySchema` as the source of truth. Domain logic lives in independently testable TypeScript modules for schema parsing, validation, runtime traversal, publication, submissions, metrics, export, and AI provider integration; Next.js UI and route handlers call those modules rather than owning business rules.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, Prisma, PostgreSQL, Zod, Vitest, Playwright, OpenAI-compatible AI provider adapter.

---

## 1. Source Documents

- PDD: `doc/pdd/2026-05-18-V0.0.1-PDD.md`
- MVP requirements: `doc/pdd/2026-05-18-V0.0.1-MVP.md`
- Architecture: `doc/architecture/2026-05-18-V0.0.1-System-Architecture.md`

---

## 2. Scope Decisions For This Plan

1. Research operator accounts are included using a minimal local email identity model, because surveys need ownership and AI provider configs need a user boundary.
2. PostgreSQL is the target database through Prisma. Local development can use a local PostgreSQL URL in `.env`.
3. Survey Schema V0.0.1 is defined as a Zod schema and exported TypeScript type.
4. Schema import and JSON-assisted editing are MVP features. A drag-and-drop flow editor is outside this plan.
5. AI generation is included through an OpenAI-compatible adapter with custom `baseUrl`, `apiKey`, and `model`.
6. AI linting is exposed as an interface. Deterministic validation ships first; model-assisted wording review is included as a non-blocking adapter method.
7. Anonymous respondent collection ships through `RespondentAccessGate`, with policy hooks for stronger modes.
8. CSV, JSON responses, and JSON schema exports ship in the MVP.

---

## 3. File Structure

Create this structure during implementation:

```text
app/
  api/
    ai/generate-schema/route.ts
    public/s/[publicId]/sessions/route.ts
    public/s/[publicId]/submissions/route.ts
    surveys/route.ts
    surveys/[surveyId]/draft/route.ts
    surveys/[surveyId]/exports/route.ts
    surveys/[surveyId]/metrics/route.ts
    surveys/[surveyId]/publish/route.ts
    surveys/[surveyId]/validate/route.ts
  public/s/[publicId]/page.tsx
  surveys/[surveyId]/page.tsx
  surveys/new/page.tsx
  layout.tsx
  page.tsx
components/
  ai/SchemaGeneratorForm.tsx
  export/ExportButtons.tsx
  metrics/SurveyMetricsPanel.tsx
  respondent/RespondentSurvey.tsx
  survey/SchemaEditor.tsx
  survey/SurveyPreview.tsx
  validation/ValidationReportPanel.tsx
lib/
  ai/openaiCompatibleProvider.ts
  ai/prompts.ts
  ai/types.ts
  export/csvExporter.ts
  export/jsonExporter.ts
  metrics/metricsService.ts
  persistence/repositories.ts
  publishing/publishingService.ts
  runtime/accessGate.ts
  runtime/runtimeEngine.ts
  runtime/submissionService.ts
  schema/exampleSurvey.ts
  schema/surveySchema.ts
  validation/graphValidator.ts
  validation/researchMetadataValidator.ts
  validation/schemaValidator.ts
  validation/types.ts
prisma/
  schema.prisma
tests/
  ai/openaiCompatibleProvider.test.ts
  export/csvExporter.test.ts
  metrics/metricsService.test.ts
  publishing/publishingService.test.ts
  runtime/runtimeEngine.test.ts
  schema/surveySchema.test.ts
  validation/schemaValidator.test.ts
  e2e/mvp-flow.spec.ts
```

Responsibility boundaries:

- `lib/schema`: schema contract, Zod parser, examples.
- `lib/validation`: deterministic validation and validation finding types.
- `lib/runtime`: respondent access, traversal, answer normalization, submission orchestration.
- `lib/publishing`: immutable version creation.
- `lib/export`: response export.
- `lib/ai`: provider-neutral AI integration.
- `lib/persistence`: Prisma-backed repositories.
- `components`: UI only, with no domain rules.
- `app/api`: thin route handlers that validate input, call services, and return JSON.

---

## 4. Implementation Tasks

### Task 1: Scaffold Application And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Initialize git and Next.js project shell**

Run:

```bash
git init
npm create next-app@latest . -- --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*"
```

Expected:

```text
Initialized empty Git repository
Success! Created humansignal
```

- [ ] **Step 2: Install MVP dependencies**

Run:

```bash
npm install zod @prisma/client
npm install -D prisma vitest @vitejs/plugin-react playwright
```

Expected:

```text
added
```

- [ ] **Step 3: Add scripts to `package.json`**

Ensure these scripts exist:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

- [ ] **Step 4: Add `.env.example`**

Create:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/humansignal?schema=public"
AI_DEFAULT_BASE_URL="http://localhost:11434/v1"
AI_DEFAULT_MODEL="llama3.1"
```

- [ ] **Step 5: Verify project shell**

Run:

```bash
npm run lint
npm run test
```

Expected:

```text
No tests found
```

or:

```text
No lint warnings or errors
```

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add .
git commit -m "chore: scaffold humansignal app"
```

---

### Task 2: Define Survey Schema V0.0.1

**Files:**
- Create: `lib/schema/surveySchema.ts`
- Create: `lib/schema/exampleSurvey.ts`
- Test: `tests/schema/surveySchema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `tests/schema/surveySchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { SurveySchemaZ } from "@/lib/schema/surveySchema";

describe("Survey Schema V0.0.1", () => {
  it("accepts the example research survey schema", () => {
    const parsed = SurveySchemaZ.parse(exampleSurveySchema);

    expect(parsed.schemaVersion).toBe("0.0.1");
    expect(parsed.variables[0].name).toBe("gender");
    expect(parsed.nodes[0].id).toBe("consent");
  });

  it("rejects unsupported schema versions", () => {
    const invalid = { ...exampleSurveySchema, schemaVersion: "0.0.2" };

    expect(() => SurveySchemaZ.parse(invalid)).toThrow();
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm run test -- tests/schema/surveySchema.test.ts
```

Expected:

```text
Cannot find module '@/lib/schema/surveySchema'
```

- [ ] **Step 3: Implement schema contract**

Create `lib/schema/surveySchema.ts` with exported Zod schemas and types for:

```ts
export type SurveySchema = z.infer<typeof SurveySchemaZ>;
export type QuestionNode = z.infer<typeof QuestionNodeZ>;
export type VariableDefinition = z.infer<typeof VariableDefinitionZ>;
export type SurveyPolicy = z.infer<typeof SurveyPolicyZ>;
export type ConsentBlock = z.infer<typeof ConsentBlockZ>;
```

Required enum values:

```ts
export const QuestionTypeZ = z.enum([
  "single_choice",
  "multiple_choice",
  "short_text",
  "long_text",
  "number",
  "likert",
  "consent",
  "terminal"
]);

export const AccessModeZ = z.enum([
  "anonymous",
  "oauth",
  "invite_only",
  "organization",
  "proof_of_personhood"
]);

export const MissingValueReasonZ = z.enum([
  "not_shown",
  "skipped",
  "refused",
  "unknown",
  "timeout",
  "system_error"
]);
```

Top-level schema must include:

```ts
schemaVersion: z.literal("0.0.1"),
survey: SurveyMetadataZ,
policy: SurveyPolicyZ,
consent: ConsentBlockZ.optional(),
variables: z.array(VariableDefinitionZ),
nodes: z.array(QuestionNodeZ),
edges: z.array(EdgeZ),
metadata: z.record(z.unknown()).default({})
```

- [ ] **Step 4: Add example schema fixture**

Create `lib/schema/exampleSurvey.ts` with:

```ts
import type { SurveySchema } from "./surveySchema";

export const exampleSurveySchema: SurveySchema = {
  schemaVersion: "0.0.1",
  survey: {
    id: "student-research-example",
    title: "Student Research Example",
    description: "A minimal research-grade survey example.",
    language: "en",
    entryNodeId: "consent"
  },
  policy: {
    accessMode: "anonymous",
    duplicatePrevention: "none",
    captcha: "off",
    piiHandling: "none"
  },
  consent: {
    id: "consent",
    title: "Consent",
    body: "Participation is voluntary. Responses are collected for a student research project.",
    required: true
  },
  variables: [
    {
      name: "gender",
      label: "Gender",
      type: "categorical",
      questionNodeId: "q_gender",
      required: true,
      coding: [
        { label: "Male", value: 1 },
        { label: "Female", value: 2 },
        { label: "Other", value: 3 },
        { label: "Prefer not to say", value: 99, missing: "refused" }
      ],
      missingValues: [{ reason: "not_shown", value: null }]
    }
  ],
  nodes: [
    { id: "consent", type: "consent", title: "Consent", variableName: null, nextNodeId: "q_gender" },
    {
      id: "q_gender",
      type: "single_choice",
      title: "What is your gender?",
      variableName: "gender",
      required: true,
      options: [
        { id: "male", label: "Male", value: 1 },
        { id: "female", label: "Female", value: 2 },
        { id: "other", label: "Other", value: 3 },
        { id: "refused", label: "Prefer not to say", value: 99, missing: "refused" }
      ],
      nextNodeId: "end"
    },
    { id: "end", type: "terminal", title: "Complete", variableName: null }
  ],
  edges: [
    { from: "consent", to: "q_gender" },
    { from: "q_gender", to: "end" }
  ],
  metadata: { template: "economics_student_basic" }
};
```

- [ ] **Step 5: Verify schema tests pass**

Run:

```bash
npm run test -- tests/schema/surveySchema.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 6: Commit schema contract**

Run:

```bash
git add lib/schema tests/schema
git commit -m "feat: define survey schema v0.0.1"
```

---

### Task 3: Implement Deterministic Validator

**Files:**
- Create: `lib/validation/types.ts`
- Create: `lib/validation/schemaValidator.ts`
- Create: `lib/validation/graphValidator.ts`
- Create: `lib/validation/researchMetadataValidator.ts`
- Test: `tests/validation/schemaValidator.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create tests for:

```ts
import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";

describe("validateSurveySchema", () => {
  it("returns no errors for the example schema", () => {
    const report = validateSurveySchema(exampleSurveySchema);

    expect(report.hasBlockingErrors).toBe(false);
    expect(report.findings.filter((finding) => finding.level === "error")).toHaveLength(0);
  });

  it("blocks publish when a branch target is missing", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: exampleSurveySchema.nodes.map((node) =>
        node.id === "q_gender" ? { ...node, nextNodeId: "missing_node" } : node
      )
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "INVALID_BRANCH_TARGET")).toBe(true);
  });

  it("warns when a closed choice variable lacks coding", () => {
    const schema = {
      ...exampleSurveySchema,
      variables: [{ ...exampleSurveySchema.variables[0], coding: [] }]
    };

    const report = validateSurveySchema(schema);

    expect(report.findings.some((finding) => finding.code === "MISSING_CODING")).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing validator tests**

Run:

```bash
npm run test -- tests/validation/schemaValidator.test.ts
```

Expected:

```text
Cannot find module '@/lib/validation/schemaValidator'
```

- [ ] **Step 3: Implement validation finding types**

Create `ValidationFinding` with:

```ts
export type ValidationLevel = "error" | "warning" | "suggestion";

export type ValidationFinding = {
  level: ValidationLevel;
  code: string;
  message: string;
  path: string;
  nodeId?: string;
  variableName?: string;
};

export type ValidationReport = {
  schemaVersion: "0.0.1";
  hasBlockingErrors: boolean;
  findings: ValidationFinding[];
};
```

- [ ] **Step 4: Implement structural, graph, and research metadata validators**

`validateSurveySchema(schema)` must combine:

- duplicate node ID detection.
- duplicate variable name detection.
- missing entry node detection.
- invalid `nextNodeId` detection.
- invalid edge target detection.
- unreachable node warning.
- missing coding warning for closed-choice variables.
- missing scale metadata warning for likert variables.
- missing missing-value policy warning.
- PII-like variable warning when PII classification is missing.

- [ ] **Step 5: Verify validator tests pass**

Run:

```bash
npm run test -- tests/validation/schemaValidator.test.ts
```

Expected:

```text
3 passed
```

- [ ] **Step 6: Commit validator**

Run:

```bash
git add lib/validation tests/validation
git commit -m "feat: add survey schema validator"
```

---

### Task 4: Add Prisma Persistence Model

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/persistence/repositories.ts`
- Modify: `.env.example`

- [ ] **Step 1: Define Prisma schema**

Create models:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  surveys   Survey[]
}

model Survey {
  id        String          @id @default(cuid())
  ownerId   String
  title     String
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  owner     User            @relation(fields: [ownerId], references: [id])
  drafts    SurveyDraft[]
  versions  SurveyVersion[]
}

model SurveyDraft {
  id        String   @id @default(cuid())
  surveyId  String
  schema    Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  survey    Survey   @relation(fields: [surveyId], references: [id])
}

model SurveyVersion {
  id        String              @id @default(cuid())
  surveyId  String
  version   Int
  publicId  String              @unique
  schema    Json
  createdAt DateTime            @default(now())
  survey    Survey              @relation(fields: [surveyId], references: [id])
  sessions  RespondentSession[]
}

model RespondentSession {
  id              String            @id @default(cuid())
  surveyVersionId String
  status          String
  startedAt       DateTime          @default(now())
  submittedAt     DateTime?
  surveyVersion   SurveyVersion     @relation(fields: [surveyVersionId], references: [id])
  submission      SubmissionRecord?
}

model SubmissionRecord {
  id                  String            @id @default(cuid())
  respondentSessionId String            @unique
  answers             Json
  shownNodeIds         Json
  branchPath           Json
  createdAt            DateTime          @default(now())
  respondentSession    RespondentSession @relation(fields: [respondentSessionId], references: [id])
}
```

- [ ] **Step 2: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected:

```text
Generated Prisma Client
```

- [ ] **Step 3: Add repository functions**

Create repository functions:

```ts
createSurveyDraft(input)
getSurveyDraft(surveyId)
saveSurveyDraft(surveyId, schema)
createSurveyVersion(input)
getSurveyVersionByPublicId(publicId)
createRespondentSession(surveyVersionId)
completeRespondentSession(sessionId, submission)
listSubmissionsForSurvey(surveyId)
```

- [ ] **Step 4: Commit persistence layer**

Run:

```bash
git add prisma lib/persistence .env.example
git commit -m "feat: add persistence model"
```

---

### Task 5: Implement Publishing Service

**Files:**
- Create: `lib/publishing/publishingService.ts`
- Test: `tests/publishing/publishingService.test.ts`

- [ ] **Step 1: Write publishing tests**

Test cases:

```ts
import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { publishSurveyDraft } from "@/lib/publishing/publishingService";

describe("publishSurveyDraft", () => {
  it("blocks publish when validation has errors", async () => {
    const invalid = {
      ...exampleSurveySchema,
      nodes: exampleSurveySchema.nodes.map((node) =>
        node.id === "q_gender" ? { ...node, nextNodeId: "missing_node" } : node
      )
    };

    const result = await publishSurveyDraft({
      surveyId: "survey_1",
      draftSchema: invalid,
      nextVersion: 1
    });

    expect(result.ok).toBe(false);
    expect(result.validationReport.hasBlockingErrors).toBe(true);
  });

  it("creates an immutable version payload when validation passes", async () => {
    const result = await publishSurveyDraft({
      surveyId: "survey_1",
      draftSchema: exampleSurveySchema,
      nextVersion: 1
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version.version).toBe(1);
      expect(result.version.publicId).toMatch(/^s_/);
    }
  });
});
```

- [ ] **Step 2: Implement service**

`publishSurveyDraft` must:

- run `validateSurveySchema`.
- return `{ ok: false, validationReport }` when errors exist.
- deep clone schema into a version payload when valid.
- generate an unguessable `publicId` prefixed with `s_`.
- never mutate `draftSchema`.

- [ ] **Step 3: Verify tests**

Run:

```bash
npm run test -- tests/publishing/publishingService.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 4: Commit publishing service**

Run:

```bash
git add lib/publishing tests/publishing
git commit -m "feat: add immutable survey publishing"
```

---

### Task 6: Implement Runtime Engine And Access Gate

**Files:**
- Create: `lib/runtime/accessGate.ts`
- Create: `lib/runtime/runtimeEngine.ts`
- Test: `tests/runtime/runtimeEngine.test.ts`

- [ ] **Step 1: Write runtime tests**

Test cases:

```ts
import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { getNextNode, startAnonymousAccess } from "@/lib/runtime/runtimeEngine";

describe("runtime engine", () => {
  it("allows anonymous access when policy is anonymous", () => {
    const result = startAnonymousAccess(exampleSurveySchema.policy);

    expect(result.allowed).toBe(true);
    expect(result.accessMode).toBe("anonymous");
  });

  it("moves from consent to the first question", () => {
    const result = getNextNode({
      schema: exampleSurveySchema,
      currentNodeId: "consent",
      answers: {}
    });

    expect(result.nextNode?.id).toBe("q_gender");
  });

  it("moves from gender question to terminal node", () => {
    const result = getNextNode({
      schema: exampleSurveySchema,
      currentNodeId: "q_gender",
      answers: { gender: 1 }
    });

    expect(result.nextNode?.id).toBe("end");
  });
});
```

- [ ] **Step 2: Implement access gate**

`startAnonymousAccess(policy)` returns:

```ts
{ allowed: true, accessMode: "anonymous" }
```

when `policy.accessMode === "anonymous"`.

For other access modes, return:

```ts
{ allowed: false, reason: "ACCESS_MODE_NOT_ENABLED" }
```

- [ ] **Step 3: Implement runtime traversal**

`getNextNode` must:

- find the current node.
- use `nextNodeId` for default traversal.
- evaluate simple branch rules when a node has branch rules.
- return terminal node when traversal reaches `terminal`.
- return a structured error when the current node or next node cannot be found.

- [ ] **Step 4: Verify runtime tests**

Run:

```bash
npm run test -- tests/runtime/runtimeEngine.test.ts
```

Expected:

```text
3 passed
```

- [ ] **Step 5: Commit runtime**

Run:

```bash
git add lib/runtime tests/runtime
git commit -m "feat: add respondent runtime engine"
```

---

### Task 7: Implement Submission And Metrics Services

**Files:**
- Create: `lib/runtime/submissionService.ts`
- Create: `lib/metrics/metricsService.ts`
- Test: `tests/metrics/metricsService.test.ts`

- [ ] **Step 1: Write metrics tests**

Create tests:

```ts
import { describe, expect, it } from "vitest";
import { calculateSurveyMetrics } from "@/lib/metrics/metricsService";

describe("calculateSurveyMetrics", () => {
  it("calculates started, completed, completion rate, and average seconds", () => {
    const metrics = calculateSurveyMetrics([
      { status: "completed", startedAt: new Date("2026-01-01T00:00:00Z"), submittedAt: new Date("2026-01-01T00:01:00Z") },
      { status: "started", startedAt: new Date("2026-01-01T00:02:00Z"), submittedAt: null }
    ]);

    expect(metrics.startedCount).toBe(2);
    expect(metrics.completedCount).toBe(1);
    expect(metrics.completionRate).toBe(0.5);
    expect(metrics.averageCompletionSeconds).toBe(60);
  });
});
```

- [ ] **Step 2: Implement submission normalization**

`normalizeSubmission` must produce:

```ts
{
  answers: Record<string, unknown>;
  shownNodeIds: string[];
  branchPath: string[];
  missingValues: Record<string, string>;
}
```

For MVP, closed-choice answers should store coded values, not labels.

- [ ] **Step 3: Implement metrics service**

`calculateSurveyMetrics` must return:

```ts
{
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageCompletionSeconds: number | null;
}
```

- [ ] **Step 4: Verify metrics tests**

Run:

```bash
npm run test -- tests/metrics/metricsService.test.ts
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit submission and metrics**

Run:

```bash
git add lib/runtime/submissionService.ts lib/metrics tests/metrics
git commit -m "feat: add submissions and metrics services"
```

---

### Task 8: Implement Export Services

**Files:**
- Create: `lib/export/csvExporter.ts`
- Create: `lib/export/jsonExporter.ts`
- Test: `tests/export/csvExporter.test.ts`

- [ ] **Step 1: Write CSV export test**

Create:

```ts
import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { exportResponsesToCsv } from "@/lib/export/csvExporter";

describe("exportResponsesToCsv", () => {
  it("uses stable variable names as headers and coded values as cells", () => {
    const csv = exportResponsesToCsv({
      schema: exampleSurveySchema,
      submissions: [
        {
          id: "submission_1",
          surveyVersionId: "version_1",
          submittedAt: "2026-01-01T00:00:00.000Z",
          answers: { gender: 1 }
        }
      ]
    });

    expect(csv).toContain("submission_id,survey_version_id,submitted_at,gender");
    expect(csv).toContain("submission_1,version_1,2026-01-01T00:00:00.000Z,1");
  });
});
```

- [ ] **Step 2: Implement CSV exporter**

Rules:

- first columns: `submission_id`, `survey_version_id`, `submitted_at`.
- following columns: `schema.variables[].name` order.
- values come from `submission.answers[variable.name]`.
- missing values are serialized as an empty cell unless a coded missing value exists.
- quote CSV cells containing comma, quote, or newline.

- [ ] **Step 3: Implement JSON exporter**

`exportResponsesToJson` returns:

```ts
{
  schemaVersion: "0.0.1";
  survey: SurveySchema["survey"];
  variables: SurveySchema["variables"];
  submissions: Array<{
    id: string;
    surveyVersionId: string;
    submittedAt: string;
    answers: Record<string, unknown>;
  }>;
}
```

- [ ] **Step 4: Verify export tests**

Run:

```bash
npm run test -- tests/export/csvExporter.test.ts
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit export services**

Run:

```bash
git add lib/export tests/export
git commit -m "feat: add research data export"
```

---

### Task 9: Implement AI Provider Abstraction

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/prompts.ts`
- Create: `lib/ai/openaiCompatibleProvider.ts`
- Test: `tests/ai/openaiCompatibleProvider.test.ts`

- [ ] **Step 1: Write provider tests**

Use a fake fetch function:

```ts
import { describe, expect, it } from "vitest";
import { generateSurveySchema } from "@/lib/ai/openaiCompatibleProvider";

describe("generateSurveySchema", () => {
  it("extracts JSON schema content from an OpenAI-compatible response", async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: "{\"schemaVersion\":\"0.0.1\",\"survey\":{\"id\":\"s\",\"title\":\"T\",\"description\":\"D\",\"language\":\"en\",\"entryNodeId\":\"end\"},\"policy\":{\"accessMode\":\"anonymous\",\"duplicatePrevention\":\"none\",\"captcha\":\"off\",\"piiHandling\":\"none\"},\"variables\":[],\"nodes\":[{\"id\":\"end\",\"type\":\"terminal\",\"title\":\"Complete\",\"variableName\":null}],\"edges\":[],\"metadata\":{}}"
            }
          }
        ]
      }));

    const result = await generateSurveySchema({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "local",
      model: "llama3.1",
      researchGoal: "Measure student study habits.",
      fetchImpl: fakeFetch
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.schema.schemaVersion).toBe("0.0.1");
    }
  });
});
```

- [ ] **Step 2: Implement prompt builder**

Prompt must instruct the model:

- output only JSON.
- use Survey Schema V0.0.1.
- include stable variable names.
- include coding for closed-choice questions.
- include missing value policy.
- avoid changing wording per respondent.

- [ ] **Step 3: Implement provider**

`generateSurveySchema` must:

- call `${baseUrl}/chat/completions`.
- send model, system prompt, and user prompt.
- parse first choice message content.
- parse JSON.
- validate with `SurveySchemaZ`.
- return `{ ok: true, schema }` or `{ ok: false, error }`.

- [ ] **Step 4: Verify AI tests**

Run:

```bash
npm run test -- tests/ai/openaiCompatibleProvider.test.ts
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit AI abstraction**

Run:

```bash
git add lib/ai tests/ai
git commit -m "feat: add ai schema generation adapter"
```

---

### Task 10: Add API Route Handlers

**Files:**
- Create: `app/api/surveys/route.ts`
- Create: `app/api/surveys/[surveyId]/draft/route.ts`
- Create: `app/api/surveys/[surveyId]/validate/route.ts`
- Create: `app/api/surveys/[surveyId]/publish/route.ts`
- Create: `app/api/surveys/[surveyId]/metrics/route.ts`
- Create: `app/api/surveys/[surveyId]/exports/route.ts`
- Create: `app/api/ai/generate-schema/route.ts`
- Create: `app/api/public/s/[publicId]/sessions/route.ts`
- Create: `app/api/public/s/[publicId]/submissions/route.ts`

- [ ] **Step 1: Implement draft and validation routes**

Required behavior:

- `POST /api/surveys` creates a survey and initial draft.
- `GET /api/surveys/{surveyId}/draft` returns current draft.
- `PUT /api/surveys/{surveyId}/draft` parses and saves schema.
- `POST /api/surveys/{surveyId}/validate` returns `ValidationReport`.

- [ ] **Step 2: Implement publish route**

Required behavior:

- `POST /api/surveys/{surveyId}/publish` runs publishing service.
- returns `409` with validation report when blocked.
- returns published version and public URL when successful.

- [ ] **Step 3: Implement public respondent routes**

Required behavior:

- `POST /api/public/s/{publicId}/sessions` starts anonymous session.
- `POST /api/public/s/{publicId}/submissions` stores completed submission.

- [ ] **Step 4: Implement metrics and export routes**

Required behavior:

- `GET /api/surveys/{surveyId}/metrics` returns metrics.
- `GET /api/surveys/{surveyId}/exports?format=csv` returns `text/csv`.
- `GET /api/surveys/{surveyId}/exports?format=json` returns `application/json`.
- `GET /api/surveys/{surveyId}/exports?format=schema` returns published schema JSON.

- [ ] **Step 5: Implement AI generation route**

Required behavior:

- `POST /api/ai/generate-schema` accepts `researchGoal`, `baseUrl`, `apiKey`, and `model`.
- calls AI provider.
- validates returned schema.
- returns schema plus validation report.

- [ ] **Step 6: Verify route compilation**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 7: Commit API routes**

Run:

```bash
git add app/api
git commit -m "feat: add mvp api routes"
```

---

### Task 11: Build Research Operator UI

**Files:**
- Create: `app/surveys/new/page.tsx`
- Create: `app/surveys/[surveyId]/page.tsx`
- Create: `components/survey/SchemaEditor.tsx`
- Create: `components/survey/SurveyPreview.tsx`
- Create: `components/validation/ValidationReportPanel.tsx`
- Create: `components/ai/SchemaGeneratorForm.tsx`
- Create: `components/export/ExportButtons.tsx`
- Create: `components/metrics/SurveyMetricsPanel.tsx`

- [ ] **Step 1: Create new survey page**

The page must let a research operator:

- create a survey draft from `exampleSurveySchema`.
- navigate to `/surveys/{surveyId}`.

- [ ] **Step 2: Create schema editor**

`SchemaEditor` must support:

- JSON textarea.
- parse button.
- save draft button.
- validation button.
- visible parse errors.

- [ ] **Step 3: Create validation report panel**

Render findings grouped by:

- errors.
- warnings.
- suggestions.

Each finding shows:

- code.
- message.
- path.
- node ID when present.
- variable name when present.

- [ ] **Step 4: Create AI schema generator form**

Fields:

- research goal.
- base URL.
- model.
- API key.

On submit:

- call `/api/ai/generate-schema`.
- place generated schema JSON into `SchemaEditor`.
- show validation report.

- [ ] **Step 5: Create preview and publish controls**

The survey page must:

- render draft preview.
- disable publish when validation errors exist.
- show public URL after publish.

- [ ] **Step 6: Create metrics and export panels**

The survey page must show:

- started count.
- completed count.
- completion rate.
- average completion time.
- export CSV button.
- export JSON button.
- export schema JSON button.

- [ ] **Step 7: Verify UI build**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 8: Commit operator UI**

Run:

```bash
git add app/surveys components
git commit -m "feat: add research operator workflow"
```

---

### Task 12: Build Respondent Runtime UI

**Files:**
- Create: `app/public/s/[publicId]/page.tsx`
- Create: `components/respondent/RespondentSurvey.tsx`

- [ ] **Step 1: Create public survey page**

The page must:

- load published survey by `publicId`.
- start anonymous session.
- render consent block first when present.
- render one question at a time.

- [ ] **Step 2: Implement respondent survey component**

Support rendering:

- consent.
- single choice.
- multiple choice.
- short text.
- long text.
- number.
- likert.
- terminal completion.

- [ ] **Step 3: Implement response validation**

Before advancing:

- required questions must have an answer.
- number questions must receive numeric input.
- single choice answers must match an option value.
- multiple choice answers must match option values.

- [ ] **Step 4: Submit completed response**

On terminal:

- call `/api/public/s/{publicId}/submissions`.
- send session ID, answers, shown node IDs, and branch path.
- show completion page after success.

- [ ] **Step 5: Verify respondent UI build**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 6: Commit respondent runtime UI**

Run:

```bash
git add app/public components/respondent
git commit -m "feat: add anonymous respondent runtime"
```

---

### Task 13: Add End-To-End MVP Flow Test

**Files:**
- Create: `tests/e2e/mvp-flow.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Configure Playwright**

`playwright.config.ts` must start the dev server:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:3000"
  }
});
```

- [ ] **Step 2: Write end-to-end test**

The test must cover:

- create survey from example.
- validate schema.
- publish survey.
- open public URL.
- submit one anonymous response.
- return to operator page.
- confirm completed count increments.
- export CSV and verify header contains `gender`.

- [ ] **Step 3: Run end-to-end test**

Run:

```bash
npm run test:e2e
```

Expected:

```text
1 passed
```

- [ ] **Step 4: Commit e2e test**

Run:

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: cover mvp survey workflow"
```

---

### Task 14: Final Verification And Documentation

**Files:**
- Create: `README.md`
- Modify: `doc/pdd/2026-05-18-V0.0.1-MVP.md`
- Modify: `doc/architecture/2026-05-18-V0.0.1-System-Architecture.md`

- [ ] **Step 1: Add README**

README must include:

- product summary.
- local setup.
- database setup.
- environment variables.
- test commands.
- MVP workflow.

- [ ] **Step 2: Update docs with implemented decisions**

Document:

- chosen schema location.
- chosen persistence approach.
- chosen validation strictness.
- chosen AI provider abstraction.
- chosen anonymous access behavior.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Expected:

```text
No lint warnings or errors
All unit tests pass
Compiled successfully
End-to-end tests pass
```

- [ ] **Step 4: Commit final docs**

Run:

```bash
git add README.md doc docs
git commit -m "docs: document mvp implementation"
```

---

## 5. Coverage Map

| Requirement | Task |
|---|---|
| Survey Schema V0.0.1 | Task 2 |
| Schema import | Task 10, Task 11 |
| Basic manual editing | Task 11 |
| AI-assisted generation | Task 9, Task 10, Task 11 |
| Validator/linter | Task 3, Task 10, Task 11 |
| Preview | Task 6, Task 11 |
| Publishing immutable version | Task 5, Task 10, Task 11 |
| Anonymous respondent runtime | Task 6, Task 10, Task 12 |
| Survey policy access gate | Task 6 |
| Data collection | Task 7, Task 10, Task 12 |
| CSV/JSON/schema export | Task 8, Task 10, Task 11 |
| Basic metrics | Task 7, Task 10, Task 11 |
| End-to-end acceptance criteria | Task 13 |

---

## 6. Verification Commands

Use these commands throughout implementation:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Database commands:

```bash
npm run prisma:generate
npm run prisma:migrate
```

---

## 7. Execution Order

Implement in this order:

1. Task 1: Scaffold.
2. Task 2: Schema.
3. Task 3: Validator.
4. Task 4: Persistence.
5. Task 5: Publishing.
6. Task 6: Runtime.
7. Task 7: Submission and metrics.
8. Task 8: Export.
9. Task 9: AI provider.
10. Task 10: API routes.
11. Task 11: Research operator UI.
12. Task 12: Respondent UI.
13. Task 13: End-to-end test.
14. Task 14: Final verification and docs.

Each task should end with a commit.
