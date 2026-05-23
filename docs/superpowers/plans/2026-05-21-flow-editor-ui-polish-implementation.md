# Flow Editor UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the flow editor UI so node cards are clearer, selected nodes are visually obvious, the graph/editor split is resizable, and answer option editing is more compact.

**Architecture:** Keep all behavior inside `SurveyFlowEditor.tsx` as local UI state and JSX/class changes. Do not change schema semantics, route helper behavior, or runtime traversal. Use existing React state and Tailwind classes.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS classes, React Flow.

---

### Task 1: Polish Graph Node Cards

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] Remove the `required` badge from graph cards.
- [ ] Increase variable badge contrast with a full border, readable text color, and stronger background.
- [ ] Make preview rows full bordered surfaces so the right side does not look visually incomplete.
- [ ] Add selected-node styling by passing `selectedNodeId` into `buildFlowNodes`.
- [ ] Ensure selected styling works together with error/warning severity.

### Task 2: Add Resizable Graph/Inspector Split

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] Add local `inspectorWidth` state.
- [ ] Add pointer drag handlers for a vertical split handle.
- [ ] Replace fixed `xl:grid-cols-[minmax(0,1fr)_340px]` / `432px` with inline `gridTemplateColumns` at `xl` and above.
- [ ] Clamp inspector width to reasonable bounds.
- [ ] Preserve existing stacked behavior below `xl`.

### Task 3: Compact Answer Options Layout

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`

- [ ] Replace the current label-above-input option layout.
- [ ] Render each option as two rows:

```text
Label  [long input]
Value  [short input] [Remove]
```

- [ ] Keep the value input compact and monospace.
- [ ] Keep Remove on the Value row.

### Task 4: Verify

**Files:**
- No production file changes expected unless verification finds issues.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run a browser smoke check against the local app.
- [ ] Commit the UI polish changes.
