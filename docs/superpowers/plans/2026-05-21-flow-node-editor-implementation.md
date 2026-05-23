# Flow Node Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the React Flow schema editor inspector so users can safely edit all relevant node fields, rename node IDs with reference synchronization, and insert/add nodes without breaking survey flow or analysis metadata.

**Architecture:** Keep `schemaText` as the single source of truth in `SurveyMaintenanceClient`. Move schema mutation logic into focused helper functions so the React Flow inspector can call predictable operations for node updates, node ID renames, and insert/add operations. Keep branch DSL editing out of this pass except for displaying existing branch rules and preserving them.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@xyflow/react`, Vitest.

---

## File Structure

- Modify `components/survey/SurveyFlowEditor.tsx`: render the richer node inspector, call mutation helpers, and expose insert/add buttons.
- Create `lib/schema/surveyNodeEditing.ts`: pure schema-editing helpers for renaming node IDs, updating node fields, creating nodes, inserting before, and adding after.
- Create `tests/schema/surveyNodeEditing.test.ts`: unit tests for reference synchronization and insert/add behavior.
- Optionally modify `docs/design/2026-05-20-schema-detail-tabs-design.md`: add a short note that node IDs are structural anchors and variable names are analysis/export keys.

## Behavioral Rules

- `node.id` is the structural node identifier. If changed, update every schema reference:
  - `survey.entryNodeId`
  - every `node.nextNodeId`
  - every `node.branches[].goto`
  - every `edge.from` and `edge.to`
  - every `variables[].questionNodeId`
- `node.variableName` is the analysis/export key. It should be shown only for answer-producing node types.
- UI label `Question` maps to schema field `title`.
- UI label `Answer Options` maps to schema field `options`.
- `Body` remains available only where it means explanatory body/copy, such as `consent`, `terminal`, or optional helper text for text/number questions.
- New or converted branch-decision nodes default `required` to true when they have branch rules that depend on their own `variableName`.
- `Insert` creates a node before the selected node. Disable it for the entry consent node.
- `Add` creates a node after the selected node. Disable it for terminal/complete nodes.
- For nodes with branches, `Add` only rewires the default `nextNodeId`; it must not rewrite existing branch targets.

---

### Task 1: Add Pure Schema Editing Helpers

**Files:**
- Create: `lib/schema/surveyNodeEditing.ts`
- Test: `tests/schema/surveyNodeEditing.test.ts`

- [ ] **Step 1: Write failing tests for node ID rename synchronization**

Create `tests/schema/surveyNodeEditing.test.ts` with tests that import `exampleSurveySchema`, call `renameNodeId`, and assert that all references update.

Required assertions:
- Renaming `q_gender` to `q_demographics_gender` updates the node ID.
- `consent.nextNodeId` updates to `q_demographics_gender`.
- `edges[0].to` updates to `q_demographics_gender`.
- `variables[0].questionNodeId` updates to `q_demographics_gender`.
- Renaming the entry node updates `survey.entryNodeId`.

- [ ] **Step 2: Run the failing test**

Run: `npm test -- tests/schema/surveyNodeEditing.test.ts`

Expected: fail because `lib/schema/surveyNodeEditing.ts` does not exist.

- [ ] **Step 3: Implement `renameNodeId`**

Create `lib/schema/surveyNodeEditing.ts` with:
- `renameNodeId(schema, oldId, newId): SurveySchema`
- validation that `newId` is non-empty
- validation that `newId` is not already used by another node
- immutable updates for nodes, survey entry, node next links, branch gotos, edges, and variable question links

- [ ] **Step 4: Run rename tests**

Run: `npm test -- tests/schema/surveyNodeEditing.test.ts`

Expected: pass for rename cases.

---

### Task 2: Add Node Field Update Semantics

**Files:**
- Modify: `lib/schema/surveyNodeEditing.ts`
- Modify: `tests/schema/surveyNodeEditing.test.ts`

- [ ] **Step 1: Add tests for `updateNode`**

Test these cases:
- Updating `title` changes only the selected node.
- Updating `type` from `single_choice` to `short_text` removes `options` and `scale`.
- Updating `type` to `single_choice` initializes two default options if options are missing.
- Updating `type` to `number` removes choice options.
- Required defaults to true when the node has branch rules using its own `variableName`.

- [ ] **Step 2: Implement `updateNode` and type normalizers**

Add:
- `updateNode(schema, nodeId, patch): SurveySchema`
- `normalizeNodeForType(node): QuestionNode`
- `nodeTypeUsesOptions(type): boolean`
- `nodeTypeUsesVariable(type): boolean`
- `isBranchDecisionNode(node): boolean`

Keep the helper pure and deterministic.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/schema/surveyNodeEditing.test.ts`

Expected: all tests pass.

---

### Task 3: Add Insert And Add Operations

**Files:**
- Modify: `lib/schema/surveyNodeEditing.ts`
- Modify: `tests/schema/surveyNodeEditing.test.ts`

- [ ] **Step 1: Add tests for `insertNodeBefore`**

Test that inserting before `q_gender`:
- creates a new node with a unique ID
- rewires `consent.nextNodeId` to the new node
- sets the new node's `nextNodeId` to `q_gender`
- updates `edges` to include `consent -> newNode -> q_gender`
- does not allow insert before the entry consent node

- [ ] **Step 2: Add tests for `addNodeAfter`**

Test that adding after `q_gender`:
- creates a new node with a unique ID
- sets `q_gender.nextNodeId` to the new node
- sets new node's `nextNodeId` to the previous default next node
- updates default-path edges
- does not allow add after terminal nodes
- preserves existing branch targets on branching nodes

- [ ] **Step 3: Implement `insertNodeBefore` and `addNodeAfter`**

Add:
- `insertNodeBefore(schema, targetNodeId, options): SurveySchema`
- `addNodeAfter(schema, sourceNodeId, options): SurveySchema`
- `createQuestionNode(schema, options): QuestionNode`
- `createUniqueNodeId(schema, base): string`
- `rebuildDefaultPathEdges(schema): SurveySchema`

Use conservative defaults:
- new type: `short_text`
- new title: `New question`
- new variable name: generated from node ID for answer-producing types

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/schema/surveyNodeEditing.test.ts`

Expected: all tests pass.

---

### Task 4: Upgrade The Flow Inspector UI

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] **Step 1: Replace inline schema mutation with helper calls**

Import the helpers from `lib/schema/surveyNodeEditing.ts`. Keep `onChange(JSON.stringify(nextSchema, null, 2))` as the final write-back.

- [ ] **Step 2: Add editable fields**

Inspector fields:
- `Node ID`: text input with helper text that it is used by flow references.
- `Question type`: select over `QuestionTypeZ.options`.
- `Question`: text input bound to `node.title`.
- `Variable name`: shown for answer-producing types.
- `Answer Options`: editable list for choice/likert types.
- `Body`: shown only for consent, terminal, and optional explanatory-body types.
- `Required`: checkbox, default selected for own-variable branch decision nodes.
- `Next node`: select using current node IDs, refreshed after node ID changes.

- [ ] **Step 3: Add insert/add controls**

Add two buttons near the inspector header:
- `Insert before`
- `Add after`

Disable rules:
- `Insert before` disabled when selected node ID equals `survey.entryNodeId`.
- `Add after` disabled when selected node type is `terminal`.

- [ ] **Step 4: Preserve selection after schema changes**

When renaming a node ID, update `selectedNodeId` to the new ID after successful rename. When inserting or adding a node, select the newly created node.

---

### Task 5: Verify UI Behavior In Browser

**Files:**
- No source changes expected unless verification finds a bug.

- [ ] **Step 1: Run static checks**

Run:
- `npm run lint`
- `npm test`
- `npm run build`

Expected: all pass.

- [ ] **Step 2: Browser smoke test**

Open a survey detail page with a valid draft. In Flow tab:
- Rename `q_gender`; confirm `Next node` options show the new ID.
- Change type from `single_choice` to `short_text`; confirm options disappear.
- Change type back to `single_choice`; confirm answer options appear.
- Click `Insert before` on a normal question; confirm a new node appears before it.
- Click `Add after` on a normal question; confirm a new node appears after it.
- Confirm insert is disabled for entry consent.
- Confirm add is disabled for terminal.
- Confirm fullscreen still works.

---

## Review Checklist

- Node ID edits preserve all structural references.
- Variable name remains distinct from node ID and is clearly labelled as analysis/export key.
- `Question` label replaces `Title` in the UI only; schema field remains `title`.
- `Answer Options` is type-aware and does not misuse `body`.
- Required default logic applies only where it is structurally justified.
- Insert/add do not rewrite branch condition targets.
- Existing preview, validation, save, publish, fullscreen, metrics, and export behavior remain intact.
