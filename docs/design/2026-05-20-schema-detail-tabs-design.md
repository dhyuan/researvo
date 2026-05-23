# Schema Detail Tabs Design

Date: 2026-05-20
Status: Implementation spec
Product area: Publisher survey maintenance

## Goal

Improve the schema detail page at `/surveys/[surveyId]` so it behaves like a focused research instrument workbench instead of a stack of unrelated panels. The page should separate editing, graph understanding, and respondent preview into clear tabs while preserving publish, validation, metrics, and export behavior.

## Layout

The page uses a compact header and a tabbed main work area.

- Header: survey ID, validation state, publish action, latest message, and public URL after publish.
- Tab 1, `Schema + Validation`: JSON editing, save, manual validate, parse errors, and validation report.
- Tab 2, `Flow`: React Flow canvas plus a node inspector for graphical editing.
- Tab 3, `Preview`: the same interaction model as the published respondent survey, running in preview mode with no submission recording.
- Operations section: metrics and exports remain available below the tabs so they do not compete with the editing workflow.

## Interaction

`Schema + Validation` remains the source of truth. The graph tab parses the current schema text and writes node edits back into the same JSON text. If the schema is invalid JSON or fails the schema parser, the graph and preview tabs show an inline blocked state.

The first graphical editing pass supports:

- Viewing nodes and schema edges in React Flow.
- Dragging nodes for inspection without persisting layout metadata.
- Selecting a node to edit title, body, required state, and `nextNodeId`.
- Updating the JSON text immediately after inspector changes.

Branch condition authoring stays in JSON for this pass. Branch edges are displayed and labelled, but the inspector does not attempt to generate condition DSL.

## Preview

Preview reuses the respondent runtime UI in a safe preview mode:

- No public session is required.
- Submit completes locally only.
- Required field validation and branching use the same runtime code as publishing.

This replaces the previous static title-only preview.

## Visual Rules

Follow the existing Researvo design guide:

- Use the neutral green research-workbench palette already defined in `app/globals.css`.
- Use existing local primitives where possible, especially `Button`, `Panel`, and `Tabs`.
- Use `lucide-react` for functional icons only.
- Avoid generic blue accents, gradients, oversized marketing composition, and nested card stacks.
- Keep controls dense but readable, with visible focus states and stable responsive dimensions.

## Verification

Run lint and tests after implementation. Start the Next dev server and inspect the target URL in the browser at desktop and mobile widths. Confirm that the React Flow canvas renders nonblank, the preview advances through questions, and publishing remains blocked when validation has errors.
