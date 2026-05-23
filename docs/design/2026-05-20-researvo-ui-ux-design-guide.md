# Researvo UI/UX Design Guide

Date: 2026-05-20
Status: Draft for redesign implementation
Product: Researvo research data collection web application

## 1. Design Direction

Researvo should feel like a precise research instrument, not a generic survey builder. The interface needs to communicate structure, trust, validation, and export readiness. The redesign should make the product feel calm, professional, and methodologically serious while staying approachable for students and individual researchers.

The current UI is functional but too plain: default typography, common blue accents, simple bordered panels, a predictable sidebar, raw respondent form controls, and minimal state design. The new direction should use a restrained editorial-operational style: quiet surfaces, strong type hierarchy, clear validation states, and dense but readable schema workflows.

Design keywords:

- Research-grade
- Methodical
- Trustworthy
- Structured
- Calm
- Analysis-ready

Avoid:

- Generic SaaS blue
- Purple or blue AI gradients
- Heavy glow effects
- Marketing-style hero sections inside the app
- Oversized cards everywhere
- Raw browser form controls
- Cute or playful survey UI

## 2. Users And Contexts

Researvo has two visually distinct user contexts.

### Publisher workspace

The publisher is a student or individual researcher creating, validating, publishing, and exporting survey schemas. This UI should feel like a research workbench: capable enough for serious methodology, but not enterprise-heavy. It can be information-dense, but the density must come from alignment, typography, and dividers rather than crowded boxes.

Primary jobs:

- Create a survey draft from research intent
- Import or edit schema JSON
- Validate schema quality
- Preview respondent flow
- Publish a frozen version
- Monitor collection metrics
- Export analysis-ready data

### Respondent runtime

The respondent is completing a public survey. This UI should feel trustworthy, quiet, and easy to finish. It should minimize app chrome and make every question state obvious.

Primary jobs:

- Understand the study and consent content
- Answer one question at a time
- See progress and required-state errors
- Submit successfully

## 3. Visual System

### Palette

Use a neutral, slightly green-tinted system with one primary accent. This moves the app away from generic SaaS blue while keeping it professional.

Core tokens:

| Token | Value | Usage |
|---|---:|---|
| `--hs-page` | `#f7f7f2` | App background |
| `--hs-surface` | `#ffffff` | Elevated work surfaces |
| `--hs-surface-muted` | `#eef1ec` | Subtle grouped areas |
| `--hs-text` | `#171a18` | Main text |
| `--hs-muted` | `#68736d` | Secondary text |
| `--hs-border` | `#d9e0da` | Hairlines and dividers |
| `--hs-primary` | `#276b62` | Primary action and active states |
| `--hs-primary-deep` | `#17463f` | Hover and pressed primary |
| `--hs-primary-soft` | `#dfece7` | Active nav and status tint |
| `--hs-warning` | `#9a6a22` | Warnings |
| `--hs-error` | `#b43b3b` | Errors |
| `--hs-success` | `#276b62` | Success |

Rules:

- Primary green is the only brand accent.
- Warning and error are semantic, not decorative.
- Do not use blue for links or active states.
- Do not use pure black.
- Use tinted shadows: `rgba(38, 54, 47, 0.08)` instead of black shadows.

### Typography

Use a technical sans and monospace pairing.

- Primary font: Geist Sans or Satoshi-style sans
- Numeric and schema font: Geist Mono or JetBrains Mono-style monospace
- No serif fonts in the app UI
- Use tabular numbers for metrics, versions, counts, and dates

Recommended scale:

| Role | Class direction | Notes |
|---|---|---|
| Page title | `text-3xl md:text-4xl font-semibold tracking-tight leading-tight` | Strong but not loud |
| Section title | `text-lg font-semibold tracking-tight` | Workbench hierarchy |
| Label | `text-sm font-medium` | Always above inputs |
| Metadata | `text-xs font-medium tracking-[0.08em] uppercase` | Sparingly, for states and IDs |
| Body | `text-sm leading-6` | Default app copy |
| Data | `font-mono tabular-nums` | Metrics and schema metadata |

Copy should be concrete and direct. Avoid words like "seamless", "elevate", and "next-gen".

## 4. Layout System

### App shell

Replace the heavy left-sidebar feel with a more modern research workbench shell:

- A compact top bar for product identity, active workspace, and primary actions.
- A slim left rail or horizontal nav for core sections.
- Main content constrained to `max-w-[1400px]`.
- Split editor pages should use a stable two-column grid: main editor plus right-side validation/preview rail.

The app should not feel like a landing page after login. The first screen should be the workspace itself.

### Page structure

Use consistent vertical sections:

1. Page header with title, concise description, and primary action.
2. Context strip for status, version, updated date, and publish state.
3. Main work area with dividers, split panels, or tabs.
4. Secondary rail for validation, preview, metrics, and exports.

Avoid stacking many identical cards. Prefer:

- `border-t`
- `divide-y`
- unboxed white space groups
- sticky side rails
- compact status strips

### Responsive behavior

- Mobile should collapse to one column.
- Split editor/preview layouts become stacked.
- Navigation becomes a horizontal scroll or compact top nav.
- Avoid fixed `h-screen`; use `min-h-[100dvh]` where full-height behavior is needed.
- Keep form controls full width on small screens.

## 5. Core Components

### Buttons

Buttons should feel tactile and restrained.

Base:

- Radius: `8px`
- Height: `40px` standard, `36px` compact
- Font: `text-sm font-medium`
- Active state: slight `translateY(1px)` or `scale(0.98)`
- Focus: visible ring using primary green

Variants:

- Primary: filled green
- Secondary: white with border
- Tertiary: text button for low-priority actions
- Danger: muted red, only for destructive actions

### Panels

Panels should not all look like generic cards. Use them only for real grouping.

Panel types:

- Work surface: white background, 1px border, 12px radius, subtle tinted shadow
- Inline group: no outer card, only `divide-y`
- Alert panel: tinted background with left border
- Sticky utility rail: white surface with border-left on desktop

### Navigation

Active nav should use primary-soft background and primary text. Include a clear current-page state. Navigation labels should remain plain and task-focused:

- Workspace
- New survey
- Profile
- Settings

Use only one icon family. The initialized shadcn preset uses `lucide-react`; keep icons functional, consistently sized, and visually secondary to labels.

### Forms

All form fields should follow one pattern:

- Label above input
- Optional helper text below label or below input
- Inline error below input
- `gap-2` within each field block
- Larger hit targets for respondent choices

Inputs:

- Radius: `8px`
- Border: `--hs-border`
- Focus border/ring: primary green
- Background: white
- Disabled state: muted background and text

### Status badges

Badges should be squared-off, not pill-shaped by default.

Use compact labels for:

- Draft
- Published
- Validating
- Has warnings
- Blocked
- Complete

## 6. Product Flows

### Sign-in page

The sign-in page should become a restrained product entry screen.

Layout:

- Asymmetric two-column layout on desktop
- Left side: product positioning and a small instrument preview
- Right side: sign-in surface
- Background: neutral page color with subtle grid or noise texture

Content:

- Lead with "Researvo"
- Supporting copy should mention schema-first research data collection
- Show proof of product purpose through a small static preview: schema checks, frozen version, export columns

### Workspace

The workspace should feel like a command center for research instruments.

Enhancements:

- Add a summary row: drafts, published surveys, responses, blocked validations
- Convert survey list into a real table on desktop with clear status, updated date, version, public URL, and action
- Collapse the survey table into stacked rows on mobile while preserving labels and actions
- Empty state should show a composed getting-started path, not just "No surveys yet"
- Use monospace for versions and response counts

### Metrics and charts

Researvo should treat charts as research telemetry, not decorative dashboard furniture.

Recommended chart patterns:

- Metric strip for started sessions, completed submissions, completion rate, and average completion time.
- Small trend line for response volume once time-series data exists.
- Funnel visualization for started to completed when drop-off analysis exists.
- Validation severity counts as compact stacked bars or grouped badges.

Rules:

- Use tabular numbers for all metrics.
- Show sample size and date range near any chart.
- Avoid pie charts for completion rate.
- Empty metrics should explain that data appears after the first response.
- Loading metrics should use skeleton rows and number blocks, not a generic spinner.

### Creation wizard

The wizard should feel like a guided research protocol builder.

Layout:

- Stepper becomes a compact progress rail or horizontal protocol tracker
- Main step content in a focused work surface
- Right rail shows live draft completeness and validation readiness
- Back/Next controls remain fixed at the bottom of the wizard area where possible

States:

- Autosaving draft
- Schema parsing
- Validation pending
- Validation blocked
- Publish ready
- Publish success

### Survey maintenance

This is the most important professional UI surface.

Layout:

- Header: survey ID, status, version, publish action
- Main grid: schema editor left, validation/preview/metrics/export rail right
- Validation report should be visually dominant when errors exist
- Public URL should be shown in a copyable field after publish

Design goal:

The page should read like an instrument control bench: editor, validator, preview, collection data, and export tools all visible without feeling chaotic.

### Respondent survey

The public survey should feel lighter than the publisher app.

Layout:

- Centered narrow reading width, `max-w-[720px]`
- Soft progress indicator
- Question type shown as small metadata, not a distracting label
- Large question title with readable line height
- Custom radio and checkbox rows with strong selected states
- Inline required errors
- Completion state with clear thank-you message and no admin chrome

Accessibility:

- Large touch targets
- Keyboard focus visible
- Errors tied to controls with `aria-describedby`
- Consent copy readable on mobile

## 7. Interaction And State Design

The current app has basic error text and some disabled states. The redesign should add complete state coverage.

Required states:

- Loading: skeleton blocks that match actual layout dimensions
- Empty: composed onboarding state with primary action
- Error: inline, specific, non-cute messages
- Disabled: visible reason where the action is blocked
- Success: calm confirmation without exclamation marks
- Active/pressed: tactile movement
- Focus: accessible green ring

Motion:

- Use CSS transitions first.
- Animate `transform` and `opacity`, not layout dimensions.
- Keep motion subtle: 180-260ms transitions with a spring-like cubic bezier.
- Do not add Framer Motion unless the implementation phase explicitly adds the dependency.

## 8. Implementation Notes

Current stack:

- Next.js App Router
- React 19
- Tailwind CSS 4
- shadcn/ui component source layer
- Radix primitives through shadcn for accessible controls
- CSS variables for Researvo theme tokens
- `lucide-react` installed by the shadcn Nova preset
- No animation library installed

### UI library policy

Use shadcn/ui as the component source layer, not as an untouched visual theme. Researvo should own its visual language through local component code, Tailwind utilities, and CSS variables.

Recommended:

- Use shadcn/ui for accessibility-sensitive primitives: buttons, inputs, labels, textareas, checkbox, radio group, select, tabs, dialog, sheet, tooltip, table, skeleton, empty state, and toast/sonner.
- Keep the Researvo theme in `app/globals.css` with Tailwind v4-compatible CSS variables.
- Customize every shadcn component to match Researvo radius, color, focus, disabled, and motion rules.
- Use proper `<table>` markup for structured survey lists and exports instead of div-only table layouts.
- Use `lucide-react` only for functional UI symbols introduced through shadcn patterns; keep stroke weight and sizing consistent.
- Prefer Server Actions for simple form mutations, and use client state/API calls only for highly interactive flows such as the schema wizard and live validation.

Avoid:

- Do not use MUI, Ant Design, Chakra, or Radix Themes for the first product UI pass.
- Do not paste shadcn blocks without redesigning them.
- Do not add a second visual system on top of shadcn.
- Do not introduce Framer Motion for the first redesign pass.

Design implementation should be incremental:

1. Update global tokens, font, body background, focus rings, and text rendering.
2. Upgrade shared primitives: `Button`, `Panel`, `StatusBadge`, `Stepper`.
3. Redesign `AppShell` and navigation.
4. Redesign workspace list and empty state.
5. Redesign wizard page and step surfaces.
6. Redesign survey maintenance editor/validation/preview rail.
7. Redesign respondent runtime controls and completion state.

Dependency policy:

- Use one icon family only; the initialized shadcn preset uses `lucide-react`.
- Do not add animation dependencies for this first visual pass.
- Use Tailwind 4-compatible CSS and existing project conventions.

## 9. Success Criteria

The redesign is successful when:

- The app immediately reads as a serious research data collection product.
- Blue SaaS defaults are gone.
- The workspace and maintenance screens feel like professional tools, not demo pages.
- Survey creation communicates validation and methodology at every step.
- Respondent controls are polished, accessible, and trustworthy.
- Loading, empty, error, disabled, and success states are designed.
- Mobile layouts remain stable and readable.
- Existing survey creation, validation, publishing, response collection, metrics, and export behavior continue to work.

## 10. Redesign Audit Summary

Current issues to fix:

- Default-feeling typography and no font personality.
- Generic blue accent across nav, links, badges, and callouts.
- Uniform bordered cards for nearly every grouped area.
- Left sidebar shell feels basic and consumes space.
- Survey list lacks table-like scanability.
- Empty state is too minimal.
- Stepper uses a generic numbered-progress pattern.
- Schema maintenance page has repeated panels and weak hierarchy.
- Respondent survey uses browser-default radio and checkbox controls.
- Buttons lack active tactile feedback.
- Loading states are not visually designed.
- Success, error, and blocked states need stronger product language.

Recommended first implementation pass:

- Keep the existing architecture and routes.
- Redesign shared components and CSS tokens first for broad impact.
- Then redesign the workspace, wizard, maintenance, and respondent surfaces in that order.
- Avoid new dependencies until the core visual system is in place.
