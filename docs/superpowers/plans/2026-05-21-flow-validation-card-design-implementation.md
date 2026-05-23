# Flow Validation Card Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the React Flow schema editor visually communicate node validation status and render polished question cards that show question content, variable names, and answer previews without changing the schema format.

**Architecture:** Keep the existing survey schema unchanged. Add pure helper functions that map `ValidationReport` findings to node-level status and summary data, then use those helpers inside `SurveyFlowEditor` to style React Flow nodes and the inspector. Render node cards from schema data instead of plain labels, and relabel the existing `body` field as `Description` in the UI.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@xyflow/react`, Tailwind CSS 4, Vitest.

---

## File Structure

- Modify `components/survey/SurveyMaintenanceClient.tsx`: pass the current validation report into `SurveyFlowEditor`.
- Modify `components/survey/SurveyFlowEditor.tsx`: render card-style nodes, node-level validation badges, inspector finding summary, and `Description` UI label.
- Create `lib/validation/nodeFindingMap.ts`: pure functions for mapping findings to node IDs and severity.
- Create `tests/validation/nodeFindingMap.test.ts`: unit tests for explicit `nodeId` and path-based finding mapping.
- Optionally update `docs/design/2026-05-20-schema-detail-tabs-design.md`: add a short note on card node visual rules and validation severity colors.

## Product And Design Rules

- Use the existing Researvo visual system: neutral surfaces, green primary, yellow warning, red error.
- Do not communicate validation state by color alone. Use icon + label/count + border treatment.
- Node cards should not show raw enum type as the primary signal.
- Node card content order:
  1. `Question` text from `node.title`.
  2. Variable chip before answer preview when `node.variableName` exists.
  3. Answer preview or response-shape preview.
  4. Compact validation badge if the node has warnings/errors.
- Answer preview rules:
  - `single_choice`, `multiple_choice`: show up to three options; if more, show `+N more`.
  - `likert`: show `Likert scale` plus range/anchor summary when available; otherwise show first three options.
  - `short_text`: show `Short text response`.
  - `long_text`: show `Long text response`.
  - `number`: show `Number response`.
  - `consent`: show `Consent copy`.
  - `terminal`: show `Completion screen`.
- Inspector top should show findings for the selected node before editable fields.
- Existing schema field `body` should be labelled `Description` for normal question nodes. For `consent`, use `Consent body`; for `terminal`, use `Completion message`.

---

### Task 1: Add Node Finding Mapping Helpers

**Files:**
- Create: `lib/validation/nodeFindingMap.ts`
- Create: `tests/validation/nodeFindingMap.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests for:
- finding with explicit `nodeId` maps to that node.
- finding path `nodes.1.variableName` maps to `schema.nodes[1].id`.
- finding path `nodes.0.branches.0.goto` maps to `schema.nodes[0].id`.
- finding path outside nodes, such as `survey.entryNodeId`, maps only if `finding.nodeId` is present.
- node severity returns `error` when any finding for that node has level `error`.
- node severity returns `warning` when findings include warnings but no errors.
- node severity returns `null` when no findings exist.

Run: `npm test -- tests/validation/nodeFindingMap.test.ts`

Expected: fail because `nodeFindingMap.ts` does not exist.

- [ ] **Step 2: Implement helper functions**

Create `lib/validation/nodeFindingMap.ts` exporting:
- `type NodeSeverity = "error" | "warning" | "suggestion" | null`
- `getFindingNodeId(schema: SurveySchema, finding: ValidationFinding): string | null`
- `groupFindingsByNode(schema: SurveySchema, findings: ValidationFinding[]): Map<string, ValidationFinding[]>`
- `getNodeSeverity(findings: ValidationFinding[]): NodeSeverity`

Implementation details:
- Prefer `finding.nodeId` when present.
- Otherwise parse `finding.path` with regex `/^nodes\.(\d+)(\.|$)/`.
- Return `schema.nodes[index]?.id ?? null`.
- Severity order is `error > warning > suggestion > null`.

- [ ] **Step 3: Run helper tests**

Run: `npm test -- tests/validation/nodeFindingMap.test.ts`

Expected: tests pass.

---

### Task 2: Pass Validation Report Into The Flow Editor

**Files:**
- Modify: `components/survey/SurveyMaintenanceClient.tsx`
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] **Step 1: Update prop contract**

Change `SurveyFlowEditorProps` to accept:

```ts
validationReport: ValidationReport | null;
```

Import `ValidationReport` from `@/lib/validation/types`.

- [ ] **Step 2: Pass current report**

In `SurveyMaintenanceClient`, change:

```tsx
<SurveyFlowEditor schemaText={schemaText} onChange={setSchemaText} />
```

to:

```tsx
<SurveyFlowEditor schemaText={schemaText} validationReport={currentValidationReport} onChange={setSchemaText} />
```

- [ ] **Step 3: Build node finding map inside Flow editor**

Inside `SurveyFlowEditor`, use:

```ts
const findingsByNode = useMemo(
  () => (parsed.ok ? groupFindingsByNode(parsed.schema, validationReport?.findings ?? []) : new Map()),
  [parsed, validationReport],
);
```

Run: `npm run lint`

Expected: no lint errors.

---

### Task 3: Redesign React Flow Nodes As Question Cards

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] **Step 1: Extract card rendering helpers**

Add local helpers:
- `answerPreviewForNode(node: QuestionNode): string[]`
- `hiddenOptionCount(node: QuestionNode): number`
- `severityStyles(severity: NodeSeverity): { border: string; bar: string; badge: string; label: string }`

Keep them in the component file unless they become too large.

- [ ] **Step 2: Update `buildFlowNodes` signature**

Change:

```ts
const buildFlowNodes = (schema: SurveySchema): FlowNode<FlowNodeData>[]
```

to:

```ts
const buildFlowNodes = (
  schema: SurveySchema,
  findingsByNode: Map<string, ValidationFinding[]>,
): FlowNode<FlowNodeData>[]
```

Use `getNodeSeverity(findingsByNode.get(node.id) ?? [])`.

- [ ] **Step 3: Render card-style nodes**

Node card structure:
- outer `div` width about `260px`, no heavy shadow.
- left/top severity strip.
- question text as main content.
- variable chip before answer preview.
- answer preview rows.
- `+N more` chip when options exceed preview count.
- validation badge with icon text if severity exists.

Do not show the raw enum type as a prominent line. Use response-shape preview instead.

- [ ] **Step 4: Verify canvas still renders**

Run: `npm run build`

Expected: build passes.

---

### Task 4: Add Inspector Finding Summary And Rename Body Labels

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] **Step 1: Add selected node findings**

Inside `SurveyFlowEditor`, derive:

```ts
const selectedNodeFindings = selectedNode ? findingsByNode.get(selectedNode.id) ?? [] : [];
const selectedNodeSeverity = getNodeSeverity(selectedNodeFindings);
```

- [ ] **Step 2: Render finding summary above editable fields**

When selected node has findings:
- Render a compact panel above `Node ID`.
- Use red/yellow styling based on highest severity.
- Show up to three findings with `code`, `message`, and `path`.
- If more than three, show `+N more findings`.
- Use `role="alert"` when severity is `error`; use `aria-live="polite"` otherwise.

- [ ] **Step 3: Rename body labels**

Use a helper:

```ts
const descriptionLabelForNode = (node: QuestionNode) => {
  if (node.type === "consent") return "Consent body";
  if (node.type === "terminal") return "Completion message";
  return "Description";
};
```

Replace the UI label `Body` with this helper. Do not change the schema field name.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: no lint errors.

---

### Task 5: Browser And Regression Verification

**Files:**
- No source changes expected unless verification finds issues.

- [ ] **Step 1: Run full verification**

Run:
- `npm run lint`
- `npm test`
- `npm run build`

Expected:
- lint exits 0
- all tests pass
- build exits 0

- [ ] **Step 2: Browser smoke test with a valid survey**

In Flow tab:
- Select a clean node; confirm no validation panel appears.
- Create or load a schema with a warning/error tied to a node.
- Confirm left node card shows yellow/red indicator with icon/text count.
- Confirm selected node inspector shows finding summary above fields.
- Confirm card still shows question, variable chip, and answer preview.
- Confirm `Description` label appears instead of `Body` for normal questions.
- Confirm fullscreen layout still works with wider right inspector.

---

## Review Checklist

- Validation status appears on both canvas node cards and inspector, not color-only.
- Node card is readable and compact: question, variable chip, answer preview, validation badge.
- Raw enum type is not the primary visual signal.
- Existing schema remains unchanged; `body` is only relabelled as `Description` in UI.
- Findings map correctly from explicit `nodeId` and `nodes.<index>` paths.
- Existing node editing, insert/add, Next node rewiring, preview, and fullscreen behavior remain intact.
