# Researvo Publisher Workspace, Auth, and Creation Wizard Design

Date: 2026-05-19
Status: Approved design
Scope: Phase 1 product and implementation design

## 1. Goal

This phase turns the current end-to-end MVP into a product-shaped publisher experience.

The system already supports the basic survey lifecycle: create a draft schema, validate it, preview it, publish a public URL, collect anonymous responses, show metrics, and export data. The next step is to add real publisher accounts, improve the information architecture, and guide users through schema creation with a clear wizard.

This phase does not implement the React Flow visual schema editor, respondent registration, WeChat login, or in-app AI provider API key execution. Those are intentionally reserved for later phases.

## 2. Product Scope

In scope:

- Publisher registration and login through SSO.
- Publisher profile data model and settings page.
- Publisher workspace after login.
- A full-page creation wizard for new surveys.
- Prompt-template workflow for external AI tools.
- Schema paste/import with automatic parse and validation.
- Survey maintenance page cleanup.
- Preview, publish, metrics, and export access within the authenticated publisher workflow.
- Clean blue research workspace visual system.
- Basic anti-bot protection through OAuth-only signup and service-side rate limits.

Out of scope:

- React Flow visual schema editing.
- Direct in-app AI schema generation using user API keys.
- AI provider key storage.
- WeChat login implementation.
- Registered respondent accounts.
- CAPTCHA/Turnstile enforcement.
- Enterprise permissions or team collaboration.

## 3. Users and Roles

MVP registration exposes only one role:

- `publisher`: creates, validates, publishes, manages, and exports surveys.

The future `respondent` role is reserved but not exposed in the UI. Respondents continue to answer public survey URLs anonymously.

Publisher profile is optional. Users can skip onboarding and complete profile fields later from settings.

## 4. Authentication Design

Use Auth.js/NextAuth with Prisma-backed users and sessions.

Supported SSO providers for this phase:

- Google
- Apple

Reserved for later:

- WeChat
- Other OAuth providers if they become useful for the target audience

Behavior:

- Unauthenticated users see a lightweight homepage with product positioning and sign-in/sign-up calls to action.
- Authenticated users are routed to the publisher workspace.
- New users are created with role `publisher`.
- All publisher-owned survey routes require authentication.
- All survey ownership checks use the authenticated user id.
- No survey creation or mutation path should rely on a mock/default user.

## 5. Publisher Profile

Add a one-to-one profile model for publisher-specific information.

Suggested fields:

- `id`
- `userId`
- `displayName`
- `industry`
- `researchField`
- `organization`
- `intendedUse`
- `region`
- `onboardingCompleted`
- `createdAt`
- `updatedAt`

Profile completion is not required to create a survey. The UI should make the profile available from the workspace but avoid blocking the user.

## 6. Anti-Bot and Abuse Controls

The first release uses low-friction controls:

- OAuth-only registration.
- Unique user email.
- Service-side rate limiting for high-cost or abuse-sensitive actions, especially survey creation and future AI generation.
- Clear architecture boundary for adding CAPTCHA/Turnstile later.

CAPTCHA is not enabled in this phase because it adds configuration and friction before the product is public.

## 7. Information Architecture

### 7.1 Public Homepage

The homepage is a lightweight product entry point:

- Researvo positioning in one short statement.
- Sign in / continue with SSO action.
- Secondary explanation that the product creates research-grade, schema-first surveys.

It should not become a marketing-heavy landing page.

### 7.2 Publisher Workspace

After login, the default route is `/workspace`.

Primary navigation:

- Surveys
- New Survey
- Profile
- Settings

Workspace content:

- Survey list with draft/published state.
- Last updated timestamp.
- Latest public URL when available.
- Response count or completion count summary when available.
- Primary action to start a new survey.

The workspace should feel like a durable research workbench rather than a one-off form builder.

### 7.3 Survey Maintenance

Existing `/surveys/[surveyId]` becomes the survey maintenance page.

Responsibilities:

- Show survey title and state.
- Show latest published URL and version metadata when available.
- Edit/import schema.
- Show automatic validation findings.
- Preview the respondent experience.
- Publish a frozen version when validation passes.
- Show metrics.
- Provide export downloads.

The page should remain useful after creation. A publisher should return here to check status, copy URLs, and download data.

## 8. Creation Wizard

New surveys are created through a full-page wizard at `/surveys/new/wizard`.

The wizard is not a modal. It is a scrollable page with a visible stepper. Earlier sections remain visible or reachable so the user can review and adjust prior inputs.

Steps:

1. Describe
   - Survey title.
   - Short description.
   - Research goal.
   - Natural-language question description.
   - Optional constraints, such as target respondent group or desired question count.

2. Prompt
   - Generate a structured prompt template for external AI tools.
   - Include the user's research goal and question description.
   - Include the Researvo schema requirements.
   - Provide a copy button.
   - Explain that generated output must be pasted back and validated before publishing.

3. Import
   - Paste schema JSON from the external AI tool.
   - Parse automatically after edits with debounce.
   - Validate automatically when parsing succeeds.
   - Show parse errors separately from schema validation findings.
   - Save valid-enough drafts automatically.

4. Review
   - Show validation report.
   - Show schema summary, such as question count, variable count, branch count, and warnings.
   - Show a respondent preview that matches the published runtime as closely as possible.
   - Block publishing if validation has errors.

5. Publish
   - Publish a frozen survey version after validation passes.
   - Show generated public URL.
   - Show version binding clearly.
   - Offer copy URL and open preview/public link actions.

The wizard should auto-save progress. Refreshing or leaving the page should not lose user-entered description or pasted schema.

## 9. AI Workflow

This phase only supports external AI prompt generation.

Behavior:

- The app provides a strong prompt template.
- The user copies it into an external AI tool.
- The user pastes the generated schema back into Researvo.
- Researvo parses and validates the schema.

The existing direct AI generation UI should be hidden from the main flow for this phase. Settings may include an AI Providers area marked as "Coming later", but the app should not ask for or store API keys yet.

## 10. Schema Validation UX

Validation should be automatic.

Rules:

- JSON parse errors are shown immediately and include useful location information when available.
- Schema validation runs after a successful parse, using debounce to avoid excessive calls.
- Findings are grouped by severity: error, warning, suggestion.
- Blocking errors clearly explain why publishing is disabled.
- Warnings and suggestions do not block publishing.
- Validation status appears in both wizard review and survey maintenance.

The user should not need to click a validation button to learn whether the schema is valid.

## 11. Preview Behavior

Preview mode should match the respondent runtime as closely as possible while staying non-destructive.

Rules:

- Preview does not create `RespondentSession`.
- Preview does not create `SubmissionRecord`.
- Preview does not affect metrics.
- Preview state stays local to the browser.
- The UI labels preview as not recorded.

This keeps metrics clean and avoids special preview records in exports.

## 12. Publishing Behavior

Publishing freezes a survey version.

Rules:

- Publishing is blocked by validation errors.
- Publishing creates a version tied to the current schema.
- The public URL is bound to the published version.
- Draft edits after publication do not mutate the already published version.
- The latest public URL is shown in the survey maintenance page and workspace list.

## 13. Metrics and Export

Metrics stay focused for this phase:

- Started count.
- Completed count.
- Completion rate.
- Average completion time when available.

Exports remain available from the survey maintenance page:

- JSON export.
- CSV export.
- Compressed package export for all collected survey data and schema metadata.

Future export improvements may include a codebook, variable dictionary, and package-specific formats for R, Stata, SPSS, or Python.

## 14. Visual Design System

The chosen direction is a clean blue research workspace.

The product should feel:

- Bright.
- Trustworthy.
- Calm.
- Research-oriented.
- Lightweight rather than enterprise-heavy.

Color tokens:

- Primary blue: `#2563EB`
- Deep primary: `#1D4ED8`
- Soft blue: `#EFF6FF`
- Page surface: `#F8FAFC`
- Raised surface: `#FFFFFF`
- Border: `#E2E8F0`
- Text: `#111827`
- Muted text: `#64748B`
- Success: `#059669`
- Warning: `#D97706`
- Error: `#DC2626`

Avoid:

- Heavy black/gray-only admin styling.
- Large dark-blue surfaces.
- Decorative blobs or gradient ornaments.
- Marketing-style hero sections inside the app.
- Nested cards.
- UI text that explains obvious controls.

Use:

- Clear page headers.
- Compact panels with 8px or smaller radius.
- Status badges.
- A visible stepper for the wizard.
- Consistent focus states.
- Accessible color contrast.
- Tailwind and local reusable components.

Do not introduce a large UI framework in this phase unless a later implementation plan identifies a clear need.

## 15. Frontend Components

Create or consolidate small local components for repeated UI patterns:

- App shell.
- Sidebar navigation.
- Page header.
- Button.
- Text input.
- Text area.
- Select.
- Panel.
- Status badge.
- Stepper.
- Validation findings list.
- Copy button.
- Empty state.

These components should remain simple and match the current Next.js + Tailwind stack.

## 16. Architecture Notes

New or changed areas:

- Auth configuration.
- Prisma user/profile/session models.
- Workspace routes.
- Wizard routes.
- Survey ownership checks.
- Auto-save draft support.
- Prompt template generation.
- Automatic validation hooks.

Reuse existing areas where possible:

- Survey schema model.
- Validator.
- Publishing service.
- Runtime preview logic.
- Metrics service.
- Export service.
- Public respondent runtime.

The implementation should keep draft-time code, runtime code, and post-collection code separate.

## 17. Data Model Direction

Likely Prisma model changes:

- Extend `User` with `role`, `name`, `image`, and auth-related relations required by Auth.js.
- Add Auth.js models: `Account`, `Session`, `VerificationToken` as needed.
- Add `PublisherProfile`.
- Add a creation draft shape or extend draft storage to include creation inputs.

The implementation plan should decide whether wizard autosave belongs in `SurveyDraft` or a separate `SurveyCreationDraft` model. The design preference is to keep wizard metadata separate from the final survey schema unless the existing draft model can absorb it cleanly without ambiguity.

## 18. Testing Strategy

The implementation should include focused tests for:

- Auth-protected publisher routes.
- Survey ownership enforcement.
- Publisher profile creation/update.
- Wizard prompt generation.
- Wizard draft autosave behavior.
- Automatic validation behavior.
- Publishing blocked by validation errors.
- Preview not creating sessions or submissions.
- Compressed export containing response data and schema metadata.

Existing validation, runtime, publishing, metrics, and export tests should continue to pass.

## 19. Open Implementation Decisions

These are intentionally left for the implementation plan:

- Exact Auth.js version and adapter setup.
- Whether to use database sessions or JWT sessions.
- Exact route grouping for authenticated app pages.
- Rate limit storage mechanism for the first local implementation.
- Whether wizard autosave creates a survey immediately or stores pre-survey creation state until import.
- Exact file layout inside the compressed export package.

## 20. Approval

Approved product decisions:

- Combine Publisher Workspace with a full-page Creation Wizard.
- Use Google and Apple SSO first.
- Reserve WeChat login for later.
- Make publisher profile skippable.
- Use OAuth plus rate limits for first anti-bot controls.
- Hide direct in-app AI API key generation for this phase.
- Use external AI prompt copy/paste workflow.
- Use clean blue research workspace visual direction.
