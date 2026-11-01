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

### Admin PWA and push notifications

The installable PWA is limited to `/admin/*` and reuses the existing
`/admin/feedback` UI, APIs, and authentication. Production push notifications
require HTTPS. `localhost` is accepted for local browser development, but a
phone visiting a LAN HTTP address is not a secure context.

Generate a long-lived VAPID key pair:

```bash
npm run push:vapid:generate
```

Add the generated keys and a contact subject to `.env`:

```dotenv
ADMIN_WEB_PUSH_ENABLED="true"
WEB_PUSH_VAPID_PUBLIC_KEY="..."
WEB_PUSH_VAPID_PRIVATE_KEY="..."
WEB_PUSH_VAPID_SUBJECT="mailto:admin@example.com"
PUSH_DISPATCH_SECRET="use-a-separate-long-random-secret"
```

Never expose the VAPID private key or dispatcher secret through a
`NEXT_PUBLIC_` variable. Push delivery uses a transactional outbox. New
messages schedule delivery with Next.js `after()` so the request lifetime
includes the background send; each run also processes queued events. This
is still bounded by the deployment function timeout and does not replace
a retry scheduler. Configure
the production scheduler to call the protected drain endpoint every minute:

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer ${PUSH_DISPATCH_SECRET}" \
  "https://your-production-domain.example/api/internal/push/drain"
```

The endpoint also accepts the secret through `X-Push-Dispatch-Secret`. Do not
put this secret in a query string or client-side code.

On iPhone, open the installed Admin app, enable reminders, and use **发送测试**
to verify delivery (including while the app is in the background). Explicitly
signing out unsubscribes that device; enable reminders again after signing in.
Session expiry alone does not unsubscribe it.

The login form supports password managers through `username` and
`current-password` autocomplete hints. It reads the current form value at
submission, including passwords filled without React input events. For Chrome
passwords in the iPhone Home Screen app, select Chrome as a provider in iOS
AutoFill settings. The website cannot force the system password suggestions
to appear; verify this on a physical iPhone after deployment.

Apply the database migration before enabling the feature. Rotating the VAPID
key pair requires every device to subscribe again. Rotating
`FEEDBACK_ADMIN_TOKEN` invalidates existing Admin sessions and stops delivery
to subscriptions created under the previous token version; sign in and enable
reminders again on each intended device.

Set `DATABASE_URL` to Neon’s pooled endpoint for application traffic and
`DIRECT_URL` to the corresponding direct endpoint for Prisma migrations:

```bash
DATABASE_URL="postgresql://postgres:password@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://postgres:password@ep-example.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

Production deployments should apply committed migrations with:

```bash
npm run prisma:migrate:deploy
```

If the database was originally created with `prisma db push` and has no Prisma
migration history yet, baseline it once before the first deploy:

```bash
npx prisma migrate resolve --applied 20260722000000_baseline
npm run prisma:migrate:deploy
npx prisma migrate status
```

Only mark the baseline as applied. Do not mark
`20260723000000_admin_web_push` as applied, because that migration must execute
to create the Push tables.

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
