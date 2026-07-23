# Researvo

Researvo is a schema-first, AI-assisted, research-grade survey MVP. It lets a research operator create or import a Survey Schema V0.0.1 draft, validate it, preview it, publish an immutable version, collect anonymous responses, and export stable variable data.

## Stack

- Next.js App Router
- TypeScript
- Prisma 6
- PostgreSQL
- Zod
- Vitest
- Playwright
- OpenAI-compatible AI provider adapter

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

FEEDBACK_ADMIN_TOKEN 用于进入 /admin/feedback 后台管理

```bash
printf 'FEEDBACK_ADMIN_TOKEN=%s\n' "$(openssl rand -base64 48)" >> .env
```

Set `DATABASE_URL` to a PostgreSQL database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/humansignal?schema=public"
```

Generate Prisma client and push the schema:

```bash
npm run prisma:generate
npx prisma db push
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## MVP Workflow

1. Create an example survey at `/surveys/new`.
2. Edit the JSON schema.
3. Validate the schema.
4. Publish a frozen version.
5. Open the generated public survey URL.
6. Submit an anonymous response.
7. Refresh metrics.
8. Export CSV, JSON, or schema JSON.

## Test Commands

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

`npm run test:e2e` requires `DATABASE_URL`. Without it, the MVP E2E test is skipped. In the Codex sandbox, the dev server may need elevated execution to bind to localhost.

## Key Implementation Locations

- Survey Schema V0.0.1: `lib/schema/surveySchema.ts`
- Example schema: `lib/schema/exampleSurvey.ts`
- Validator/linter: `lib/validation/`
- Runtime engine: `lib/runtime/runtimeEngine.ts`
- Respondent access gate: `lib/runtime/accessGate.ts`
- Publishing service: `lib/publishing/publishingService.ts`
- Persistence repositories: `lib/persistence/repositories.ts`
- Export services: `lib/export/`
- AI provider adapter: `lib/ai/openaiCompatibleProvider.ts`
