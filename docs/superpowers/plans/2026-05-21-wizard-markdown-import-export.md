# Wizard Markdown Import Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-step wizard Markdown import/export for title, description, research goal, questions, and optional constraints.

**Architecture:** Put Markdown parsing and formatting in a focused `lib/wizard` utility with unit tests. Keep DOM-only file picker and download behavior in `DescribeStep`, where the form state already lives.

**Tech Stack:** Next.js client components, TypeScript, Vitest, browser FileReader and Blob URL APIs.

---

### Task 1: Markdown Utility

**Files:**
- Create: `lib/wizard/markdownBrief.ts`
- Create: `tests/wizard/markdownBrief.test.ts`

- [ ] **Step 1: Write failing tests**

Cover formatting, round-trip parsing, case-insensitive headings, required-field failures, optional constraints, and multiline content in `tests/wizard/markdownBrief.test.ts`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/wizard/markdownBrief.test.ts`
Expected: fails because `@/lib/wizard/markdownBrief` does not exist.

- [ ] **Step 3: Implement parser and formatter**

Export:
- `formatWizardBriefMarkdown(value: WizardBriefMarkdownValue): string`
- `parseWizardBriefMarkdown(markdown: string): WizardBriefMarkdownValue`
- `WizardBriefMarkdownError`

Required import fields are non-empty `title`, `description`, `researchGoal`, and `questionDescription`; `constraints` defaults to an empty string.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/wizard/markdownBrief.test.ts`
Expected: pass.

### Task 2: First-Step UI Controls

**Files:**
- Modify: `components/wizard/DescribeStep.tsx`
- Test: `tests/wizard/markdownBrief.test.ts`

- [ ] **Step 1: Add import/export controls**

Use the utility in `DescribeStep`. Import reads `.md`/text files and calls `onChange(parsedValue)` only after parsing succeeds. Export creates a Markdown Blob and downloads it with a title-based filename or `survey-brief.md`.

- [ ] **Step 2: Add inline import error**

Show one concise error under the controls when parsing or file reading fails. Clear the error after successful import/export or field changes.

- [ ] **Step 3: Run focused verification**

Run: `npm test -- tests/wizard/markdownBrief.test.ts`
Expected: pass.

- [ ] **Step 4: Run type and lint checks**

Run: `npm run lint`
Expected: pass.

Run: `npm test -- tests/wizard/markdownBrief.test.ts tests/wizard/promptTemplate.test.ts`
Expected: pass.
