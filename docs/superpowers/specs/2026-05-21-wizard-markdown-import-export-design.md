# Wizard Markdown Import and Export Design

## Context

The creation wizard already collects the fields needed to brief an external AI schema generator in its first step:

- `title`
- `description`
- `researchGoal`
- `questionDescription`
- `constraints`

The first release will let users import and export these fields as a plain Markdown document from the first wizard step. The feature is intentionally browser-side only: it does not require database changes, API changes, or a new server endpoint because the existing draft autosave already persists form changes after import.

## Goals

- Let users export the first-step wizard context into a readable `.md` file.
- Let users import a `.md` file and populate the first-step wizard fields.
- Keep the first release predictable by supporting one fixed Markdown shape.
- Preserve the existing autosave behavior after imported values are applied.
- Treat `title`, `description`, `researchGoal`, and `questionDescription` as required import fields.

## Non-Goals

- No YAML frontmatter support in the first release.
- No free-form or AI-assisted Markdown interpretation.
- No schema JSON import/export changes.
- No server-side file storage.

## Markdown Format

Exported Markdown uses this structure:

```md
# Survey title

## Description
Short description text.

## Goal
Research goal text.

## Questions
Question description or question list text.

## Constraints
Constraint text.
```

Import expects the same section names. Matching should be case-insensitive for the section headings, but the parser should remain strict enough to avoid surprising mappings.

Required import fields:

- Document `#` title
- `## Description`
- `## Goal`
- `## Questions`

`## Constraints` is optional. When the section is missing or blank, imported `constraints` should become an empty string.

Field mapping:

- Document `#` heading maps to `title`.
- `## Description` maps to `description`.
- `## Goal` maps to `researchGoal`.
- `## Questions` maps to `questionDescription`.
- `## Constraints` maps to `constraints`.

## User Experience

The first wizard step should expose two compact actions near the top of the form:

- `Import Markdown`: opens a file picker accepting Markdown/text files.
- `Export Markdown`: downloads a Markdown file generated from the current form values.

Import replaces the current first-step field values with the parsed Markdown values. Once values are applied through the existing `onChange` path, the existing draft autosave should persist them.

If import fails, the UI should show a short inline error in the first step and leave the existing field values unchanged.

Export should produce a filename based on the current title when available, falling back to a stable default such as `survey-brief.md`.

## Components and Boundaries

Add a small Markdown utility module under `lib/wizard` for formatting and parsing. Keeping this logic outside the React component makes it easy to test and avoids binding the parser to DOM APIs.

Update `DescribeStep` to:

- Render import/export controls.
- Own file picker interaction and browser download behavior.
- Call the Markdown utility for parse and format work.
- Keep field rendering and `onChange` behavior unchanged.

No changes are required in:

- `creationDraftService`
- creation draft API routes
- Prisma schema
- prompt generation

## Error Handling

The parser should reject Markdown that does not contain non-empty values for all required fields: title, description, goal, and questions. It should also report missing required structural sections when the document cannot be safely mapped.

The first-step UI should surface one clear message, such as:

`Markdown import failed. Use # Title and non-empty ## Description, ## Goal, and ## Questions sections.`

Import should not partially apply values when parsing fails.

## Testing

Add focused unit tests for the Markdown utility:

- Formats a full wizard draft into the expected Markdown shape.
- Parses exported Markdown back into the expected `DescribeValue`-compatible object.
- Parses headings case-insensitively.
- Rejects Markdown with missing title, description, goal, or questions content.
- Allows missing or blank constraints by returning an empty `constraints` value.
- Preserves multiline section content.

Component-level testing is optional for the first release because most risk sits in parser/formatter behavior. Existing wizard autosave behavior remains covered by the current architecture.
