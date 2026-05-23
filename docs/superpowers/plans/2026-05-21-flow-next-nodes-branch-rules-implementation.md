# Flow Next Nodes Branch Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a graph editor inspector where "Next nodes" can select multiple route targets, one target is an explicit default, and non-default targets are configured as branch rules.

**Architecture:** Keep the schema format unchanged: `nextNodeId` is the default route, and `branches[]` are conditional routes. Add a focused schema route helper module for deriving selected targets, selecting defaults, creating branch defaults, and writing updates; keep the React component responsible for rendering controls and calling those helpers. Preserve the existing `schemaText` single-source-of-truth flow by writing updated schemas through `onChange`.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest, existing `SurveySchema`/`QuestionNode`/`BranchRule` types, existing `SurveyFlowEditor` and `surveyNodeEditing` helpers.

---

## Current Workspace Note

`components/survey/SurveyFlowEditor.tsx` has existing uncommitted edits. Treat them as user work. Do not revert them. Integrate the final implementation with the edited branch-rule UI or carefully replace the overlapping inspector section with the new designed UI.

## File Structure

- Create `lib/schema/surveyRouteEditing.ts`
  - Owns route selection derivation and schema-safe route updates.
  - Exports pure helpers used by the UI and tested with Vitest.
- Create `tests/schema/surveyRouteEditing.test.ts`
  - Covers route target derivation, default selection, branch preservation, deselection, and edge rebuild behavior.
- Modify `components/survey/SurveyFlowEditor.tsx`
  - Replaces the single `Next node` select with a visible multi-target checkbox list.
  - Reworks Branch Rules into a default route row plus conditional rows.
  - Continues to call `writeSchema(rebuildDefaultPathEdges(...))` or helper functions that already rebuild edges.
- Optionally modify `tests/schema/surveyNodeEditing.test.ts`
  - Only if moving shared helper exports from `surveyNodeEditing.ts` requires import adjustments.

---

### Task 1: Add Route Editing Helper Tests

**Files:**
- Create: `tests/schema/surveyRouteEditing.test.ts`
- Later implementation: `lib/schema/surveyRouteEditing.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `tests/schema/surveyRouteEditing.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import {
  applyRouteTargets,
  createDefaultBranchRule,
  deriveRouteTargets,
} from "@/lib/schema/surveyRouteEditing";

const cloneSchema = (schema: SurveySchema = exampleSurveySchema): SurveySchema => structuredClone(schema);

const node = (schema: SurveySchema, nodeId = "q_gender") => {
  const found = schema.nodes.find((candidate) => candidate.id === nodeId);

  if (!found) {
    throw new Error(`Missing test node ${nodeId}`);
  }

  return found;
};

describe("survey route editing", () => {
  it("derives branch targets first and default target last", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      nodes: base.nodes.map((candidate) =>
        candidate.id === "q_gender"
          ? {
              ...candidate,
              nextNodeId: "end",
              branches: [
                { variableName: "gender", operator: "equals", value: 1, goto: "consent" },
                { variableName: "gender", operator: "equals", value: 2, goto: "end" },
              ],
            }
          : candidate,
      ),
    };

    expect(deriveRouteTargets(node(schema))).toEqual({
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
  });

  it("selects one target as nextNodeId without branches", () => {
    const updated = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["end"],
      defaultTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("end");
    expect(node(updated).branches).toBeUndefined();
    expect(updated.edges).toContainEqual({ from: "q_gender", to: "end" });
  });

  it("uses the last newly selected target as the default route", () => {
    const updated = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      addedTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("end");
    expect(node(updated).branches).toEqual([
      { variableName: "gender", operator: "equals", value: 1, goto: "consent" },
    ]);
    expect(updated.edges).toContainEqual({
      from: "q_gender",
      to: "consent",
      condition: { variableName: "gender", operator: "equals", value: 1, goto: "consent" },
    });
    expect(updated.edges).toContainEqual({ from: "q_gender", to: "end" });
  });

  it("changes default and moves the previous default into conditional routes", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "consent",
    });

    expect(node(updated).nextNodeId).toBe("consent");
    expect(node(updated).branches).toEqual([
      { variableName: "gender", operator: "equals", value: 1, goto: "end" },
    ]);
  });

  it("removes deselected conditional targets", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: ["end"],
      defaultTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("end");
    expect(node(updated).branches).toBeUndefined();
  });

  it("chooses the remaining target when the default target is deselected", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: ["consent"],
      removedTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBe("consent");
    expect(node(updated).branches).toBeUndefined();
  });

  it("clears nextNodeId and branches when all route targets are deselected", () => {
    const base = applyRouteTargets(cloneSchema(), "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });
    const updated = applyRouteTargets(base, "q_gender", {
      selectedTargetIds: [],
      removedTargetId: "end",
    });

    expect(node(updated).nextNodeId).toBeUndefined();
    expect(node(updated).branches).toBeUndefined();
    expect(updated.edges.some((edge) => edge.from === "q_gender")).toBe(false);
  });

  it("preserves existing branch details for selected non-default targets", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      nodes: base.nodes.map((candidate) =>
        candidate.id === "q_gender"
          ? {
              ...candidate,
              nextNodeId: "end",
              branches: [{ variableName: "gender", operator: "not_equals", value: 2, goto: "consent" }],
            }
          : candidate,
      ),
    };
    const updated = applyRouteTargets(schema, "q_gender", {
      selectedTargetIds: ["consent", "end"],
      defaultTargetId: "end",
    });

    expect(node(updated).branches).toEqual([
      { variableName: "gender", operator: "not_equals", value: 2, goto: "consent" },
    ]);
  });

  it("creates an exists rule when the selected node has no option value", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      variables: [...base.variables, { name: "comment", label: "Comment", type: "text", questionNodeId: "q_comment" }],
      nodes: [
        ...base.nodes,
        { id: "q_comment", type: "short_text", title: "Comment", variableName: "comment", nextNodeId: "end" },
      ],
    };

    expect(createDefaultBranchRule(schema, node(schema, "q_comment"), "end")).toEqual({
      variableName: "comment",
      operator: "exists",
      goto: "end",
    });
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm test -- tests/schema/surveyRouteEditing.test.ts
```

Expected: FAIL because `@/lib/schema/surveyRouteEditing` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/schema/surveyRouteEditing.test.ts
git commit -m "test: cover survey route editing helpers"
```

---

### Task 2: Implement Route Editing Helpers

**Files:**
- Create: `lib/schema/surveyRouteEditing.ts`
- Test: `tests/schema/surveyRouteEditing.test.ts`

- [ ] **Step 1: Add the helper module**

Create `lib/schema/surveyRouteEditing.ts` with:

```ts
import type { BranchRule, QuestionNode, SurveySchema } from "@/lib/schema/surveySchema";
import { nodeTypeUsesOptions, rebuildDefaultPathEdges, updateNode } from "@/lib/schema/surveyNodeEditing";

type RouteTargets = {
  selectedTargetIds: string[];
  defaultTargetId?: string;
};

export type ApplyRouteTargetsInput = RouteTargets & {
  addedTargetId?: string;
  removedTargetId?: string;
};

const unique = (values: string[]) => {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
};

const findNode = (schema: SurveySchema, nodeId: string) => {
  const node = schema.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new Error(`Node "${nodeId}" does not exist`);
  }

  return node;
};

export const deriveRouteTargets = (node: QuestionNode): RouteTargets => {
  const branchTargetIds = node.branches?.map((branch) => branch.goto) ?? [];
  const selectedTargetIds = unique([...branchTargetIds, node.nextNodeId ?? ""]).filter((targetId) => targetId !== node.id);

  return {
    selectedTargetIds,
    defaultTargetId: node.nextNodeId,
  };
};

const fallbackVariableName = (schema: SurveySchema, node: QuestionNode) =>
  node.variableName || schema.variables[0]?.name;

export const createDefaultBranchRule = (
  schema: SurveySchema,
  node: QuestionNode,
  targetId: string,
): BranchRule | null => {
  const variableName = fallbackVariableName(schema, node);

  if (!variableName) {
    return null;
  }

  if (nodeTypeUsesOptions(node.type) && node.options?.[0]) {
    return {
      variableName,
      operator: "equals",
      value: node.options[0].value,
      goto: targetId,
    };
  }

  return {
    variableName,
    operator: "exists",
    goto: targetId,
  };
};

const chooseDefaultTarget = (currentNode: QuestionNode, input: ApplyRouteTargetsInput) => {
  if (input.selectedTargetIds.length === 0) {
    return undefined;
  }

  if (input.addedTargetId && input.selectedTargetIds.includes(input.addedTargetId)) {
    return input.addedTargetId;
  }

  if (input.defaultTargetId && input.selectedTargetIds.includes(input.defaultTargetId)) {
    return input.defaultTargetId;
  }

  if (currentNode.nextNodeId && input.selectedTargetIds.includes(currentNode.nextNodeId)) {
    return currentNode.nextNodeId;
  }

  return input.selectedTargetIds[input.selectedTargetIds.length - 1];
};

export const applyRouteTargets = (
  schema: SurveySchema,
  nodeId: string,
  input: ApplyRouteTargetsInput,
): SurveySchema => {
  const currentNode = findNode(schema, nodeId);
  const selectedTargetIds = unique(input.selectedTargetIds).filter((targetId) => targetId !== nodeId);
  const defaultTargetId = chooseDefaultTarget(currentNode, { ...input, selectedTargetIds });

  if (selectedTargetIds.length === 0) {
    const cleared = updateNode(schema, nodeId, {
      nextNodeId: undefined,
      branches: undefined,
    });

    return rebuildDefaultPathEdges(cleared);
  }

  const existingBranchByTarget = new Map((currentNode.branches ?? []).map((branch) => [branch.goto, branch]));
  const conditionalTargetIds = selectedTargetIds.filter((targetId) => targetId !== defaultTargetId);
  const branches = conditionalTargetIds
    .map((targetId) => existingBranchByTarget.get(targetId) ?? createDefaultBranchRule(schema, currentNode, targetId))
    .filter((branch): branch is BranchRule => Boolean(branch));

  const updated = updateNode(schema, nodeId, {
    nextNodeId: defaultTargetId,
    branches: branches.length ? branches : undefined,
  });

  return rebuildDefaultPathEdges(updated);
};

export const updateBranchRule = (
  schema: SurveySchema,
  nodeId: string,
  branchIndex: number,
  branch: BranchRule,
): SurveySchema => {
  const currentNode = findNode(schema, nodeId);
  const branches = [...(currentNode.branches ?? [])];

  branches[branchIndex] = branch;

  return rebuildDefaultPathEdges(updateNode(schema, nodeId, { branches: branches.length ? branches : undefined }));
};

export const removeBranchRule = (
  schema: SurveySchema,
  nodeId: string,
  branchIndex: number,
): SurveySchema => {
  const currentNode = findNode(schema, nodeId);
  const branches = [...(currentNode.branches ?? [])];

  branches.splice(branchIndex, 1);

  return rebuildDefaultPathEdges(updateNode(schema, nodeId, { branches: branches.length ? branches : undefined }));
};
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
npm test -- tests/schema/surveyRouteEditing.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run related schema tests**

Run:

```bash
npm test -- tests/schema/surveyNodeEditing.test.ts tests/schema/surveyFlowLayout.test.ts tests/validation/graphValidator.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit helper implementation**

```bash
git add lib/schema/surveyRouteEditing.ts tests/schema/surveyRouteEditing.test.ts
git commit -m "feat: add survey route editing helpers"
```

---

### Task 3: Wire Multi-Target Routing Into SurveyFlowEditor

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`
- Uses: `lib/schema/surveyRouteEditing.ts`

- [ ] **Step 1: Update imports**

In `components/survey/SurveyFlowEditor.tsx`, add the route helper import and keep existing schema node editing imports:

```ts
import {
  applyRouteTargets,
  deriveRouteTargets,
  removeBranchRule,
  updateBranchRule,
} from "@/lib/schema/surveyRouteEditing";
```

- [ ] **Step 2: Add selected-route derived state and handlers**

Inside `SurveyFlowEditor`, after `selectedSeverityStyles`, add:

```ts
  const selectedRouteTargets = selectedNode
    ? deriveRouteTargets(selectedNode)
    : { selectedTargetIds: [], defaultTargetId: undefined };
  const availableRouteTargets = parsed.schema.nodes.filter((node) => node.id !== selectedNode?.id);

  const updateRouteTargets = (targetId: string, checked: boolean) => {
    if (!selectedNode) {
      return;
    }

    const selectedTargetIds = checked
      ? [...selectedRouteTargets.selectedTargetIds, targetId]
      : selectedRouteTargets.selectedTargetIds.filter((selectedTargetId) => selectedTargetId !== targetId);

    writeSchema(
      applyRouteTargets(parsed.schema, selectedNode.id, {
        selectedTargetIds,
        defaultTargetId: selectedRouteTargets.defaultTargetId,
        addedTargetId: checked ? targetId : undefined,
        removedTargetId: checked ? undefined : targetId,
      }),
    );
  };

  const updateDefaultRouteTarget = (defaultTargetId: string) => {
    if (!selectedNode) {
      return;
    }

    writeSchema(
      applyRouteTargets(parsed.schema, selectedNode.id, {
        selectedTargetIds: selectedRouteTargets.selectedTargetIds,
        defaultTargetId,
      }),
    );
  };
```

If TypeScript reports `writeSchema` is used before declaration, move this block below the `writeSchema` function.

- [ ] **Step 3: Replace `updateNextNode`**

Delete the old `updateNextNode(nextNodeId: string)` function. Route updates now go through `updateRouteTargets` and `updateDefaultRouteTarget`.

- [ ] **Step 4: Replace the old Next node select with a checkbox list**

Replace the current `<label>` block whose label text is `Next node` with:

```tsx
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--hs-text)]">
                  Next nodes
                </span>
                {selectedRouteTargets.defaultTargetId ? (
                  <span className="truncate text-xs text-[var(--hs-muted)]">
                    Default: {selectedRouteTargets.defaultTargetId}
                  </span>
                ) : null}
              </div>
              <div className="max-h-44 overflow-auto rounded-lg border border-[var(--hs-border)] bg-white p-2">
                {availableRouteTargets.map((node) => {
                  const checked = selectedRouteTargets.selectedTargetIds.includes(node.id);
                  const isDefault = checked && selectedRouteTargets.defaultTargetId === node.id;

                  return (
                    <label
                      key={node.id}
                      className="flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-[var(--hs-text)] hover:bg-[var(--hs-surface-muted)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          className="size-4 shrink-0 rounded border-[var(--hs-border)] accent-[var(--hs-primary)]"
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => updateRouteTargets(node.id, event.target.checked)}
                        />
                        <span className="truncate font-mono">{node.id}</span>
                      </span>
                      {isDefault ? (
                        <span className="shrink-0 rounded border border-[var(--hs-primary)]/20 bg-[var(--hs-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--hs-primary-deep)]">
                          Default
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
```

- [ ] **Step 5: Replace the Branch Rules panel**

Replace the current Branch Rules panel with:

```tsx
            <div className="rounded-lg border border-[var(--hs-border)] bg-[var(--hs-surface-muted)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-[var(--hs-muted)]">
                  Branch rules
                </p>
                <span className="text-xs text-[var(--hs-muted)]">
                  {selectedRouteTargets.selectedTargetIds.length > 1
                    ? `${selectedRouteTargets.selectedTargetIds.length - 1} conditional`
                    : "No conditions needed"}
                </span>
              </div>

              <div className="mt-3 space-y-3 text-xs text-[var(--hs-text)]">
                {selectedRouteTargets.selectedTargetIds.length === 0 ? (
                  <div className="text-xs text-[var(--hs-muted)]">
                    No next nodes selected
                  </div>
                ) : selectedRouteTargets.selectedTargetIds.length === 1 ? (
                  <div className="rounded-md border border-[var(--hs-border)] bg-white px-3 py-2">
                    <span className="text-[var(--hs-muted)]">Default route: </span>
                    <span className="font-mono">{selectedRouteTargets.defaultTargetId}</span>
                  </div>
                ) : (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[var(--hs-muted)]">
                        Default route
                      </span>
                      <select
                        className="h-9 w-full rounded-md border border-[var(--hs-border)] bg-white px-2 text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                        value={selectedRouteTargets.defaultTargetId ?? ""}
                        onChange={(event) => updateDefaultRouteTarget(event.target.value)}
                      >
                        {selectedRouteTargets.selectedTargetIds.map((targetId) => (
                          <option key={targetId} value={targetId}>
                            {targetId}
                          </option>
                        ))}
                      </select>
                    </label>

                    {(selectedNode.branches ?? []).map((branch, index) => {
                      const variableOptions = parsed.schema.variables.map((v) => v.name);
                      const targetNodeOptions = selectedRouteTargets.selectedTargetIds.filter(
                        (targetId) => targetId !== selectedRouteTargets.defaultTargetId,
                      );

                      return (
                        <div
                          key={`${branch.goto}-${index}`}
                          className="grid grid-cols-[minmax(0,1fr)_110px_90px] gap-2 rounded-md border border-[var(--hs-border)] bg-white p-2"
                        >
                          <select
                            className="h-9 min-w-0 rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none"
                            value={branch.variableName}
                            onChange={(event) =>
                              updateSelectedBranch(index, {
                                ...branch,
                                variableName: event.target.value,
                              })
                            }
                          >
                            {variableOptions.map((variableName) => (
                              <option key={variableName} value={variableName}>
                                {variableName}
                              </option>
                            ))}
                          </select>

                          <select
                            className="h-9 rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none"
                            value={branch.operator}
                            onChange={(event) =>
                              updateSelectedBranch(index, normalizeBranchOperator(branch, event.target.value as BranchRule["operator"]))
                            }
                          >
                            <option value="equals">equals</option>
                            <option value="not_equals">not equals</option>
                            <option value="in">in</option>
                            <option value="not_in">not in</option>
                            <option value="exists">exists</option>
                            <option value="missing">missing</option>
                          </select>

                          {branch.operator === "exists" || branch.operator === "missing" ? (
                            <div className="flex h-9 items-center rounded-md border border-transparent px-2 text-sm text-[var(--hs-muted)]">
                              no value
                            </div>
                          ) : (
                            <input
                              className="h-9 min-w-0 rounded-md border border-[var(--hs-border)] px-2 font-mono text-sm outline-none"
                              value={"value" in branch ? formatBranchEditorValue(branch.value) : ""}
                              onChange={(event) =>
                                updateSelectedBranch(index, {
                                  ...branch,
                                  value: parseBranchEditorValue(event.target.value, branch.operator),
                                } as BranchRule)
                              }
                            />
                          )}

                          <div className="col-span-3 flex items-center gap-2">
                            <span className="text-xs text-[var(--hs-muted)]">Go to</span>
                            <select
                              className="h-9 min-w-0 flex-1 rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none"
                              value={branch.goto}
                              onChange={(event) =>
                                updateSelectedBranch(index, {
                                  ...branch,
                                  goto: event.target.value,
                                })
                              }
                            >
                              {targetNodeOptions.map((targetId) => (
                                <option key={targetId} value={targetId}>
                                  {targetId}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                if (!selectedNode) {
                                  return;
                                }

                                writeSchema(removeBranchRule(parsed.schema, selectedNode.id, index));
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
```

- [ ] **Step 6: Add branch edit utility functions used by JSX**

Place these helper functions near `parseOptionValue`/`optionValueText` or near other component-local helpers:

```ts
const formatBranchEditorValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return value === undefined || value === null ? "" : String(value);
};

const parseBranchScalarValue = (value: string) => {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);

  return value;
};

const parseBranchEditorValue = (value: string, operator: BranchRule["operator"]) => {
  if (operator === "in" || operator === "not_in") {
    return value
      .split(",")
      .map((item) => parseBranchScalarValue(item))
      .filter((item) => item !== "");
  }

  return parseBranchScalarValue(value);
};

const normalizeBranchOperator = (branch: BranchRule, operator: BranchRule["operator"]): BranchRule => {
  if (operator === "exists" || operator === "missing") {
    return {
      variableName: branch.variableName,
      operator,
      goto: branch.goto,
    };
  }

  if (operator === "in" || operator === "not_in") {
    return {
      variableName: branch.variableName,
      operator,
      value: "value" in branch ? (Array.isArray(branch.value) ? branch.value : [branch.value]) : [],
      goto: branch.goto,
    };
  }

  return {
    variableName: branch.variableName,
    operator,
    value: "value" in branch && !Array.isArray(branch.value) ? branch.value : "",
    goto: branch.goto,
  };
};
```

Inside `SurveyFlowEditor`, after `updateDefaultRouteTarget`, add:

```ts
  const updateSelectedBranch = (index: number, branch: BranchRule) => {
    if (!selectedNode) {
      return;
    }

    writeSchema(updateBranchRule(parsed.schema, selectedNode.id, index, branch));
  };
```

- [ ] **Step 7: Run TypeScript-facing tests**

Run:

```bash
npm test -- tests/schema/surveyRouteEditing.test.ts tests/schema/surveyNodeEditing.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit editor wiring**

```bash
git add components/survey/SurveyFlowEditor.tsx lib/schema/surveyRouteEditing.ts tests/schema/surveyRouteEditing.test.ts
git commit -m "feat: support multi-target flow routing"
```

---

### Task 4: Polish Inspector Behavior and Verify

**Files:**
- Modify: `components/survey/SurveyFlowEditor.tsx`
- Test: existing Vitest suite

- [ ] **Step 1: Check empty-variable branch rows**

If TypeScript or manual testing shows that `createDefaultBranchRule` returns `null` and no conditional row appears, add this inline message below the default route selector:

```tsx
                    {selectedRouteTargets.selectedTargetIds.length > 1 &&
                    (selectedNode.branches ?? []).length === 0 ? (
                      <div className="rounded-md border border-[var(--hs-warning)]/30 bg-[var(--hs-warning)]/10 px-3 py-2 text-xs text-[var(--hs-text)]">
                        Add a variable before configuring conditional routes.
                      </div>
                    ) : null}
```

- [ ] **Step 2: Run full validation**

Run:

```bash
npm test
npm run lint
```

Expected: both commands complete successfully.

- [ ] **Step 3: Start the app for manual UI verification**

Run:

```bash
npm run dev
```

Expected: Next.js reports a local URL such as `http://localhost:3000`.

- [ ] **Step 4: Manually verify the inspector**

In the browser, open the survey maintenance screen that contains the Schema Flow editor and verify:

- Selecting no route target clears outgoing edges from the selected node.
- Selecting one target shows `Default route: <target>` and no condition fields.
- Selecting two targets marks the second selected target as `Default`.
- Changing the default dropdown rewrites the default edge and leaves the other target as a conditional branch edge.
- Editing variable/operator/value updates the branch edge label.
- Removing a conditional row removes that selected route target from `branches[]` or leaves the route list consistent.
- Existing branch rules from the current dirty `SurveyFlowEditor.tsx` work are not accidentally lost unless the target is deselected or made default.

- [ ] **Step 5: Commit polish**

If code changed in this task:

```bash
git add components/survey/SurveyFlowEditor.tsx
git commit -m "fix: polish flow route inspector states"
```

If no code changed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Multi-select next nodes: Task 3, Steps 4 and 5.
- Existing schema model preserved: Task 2 helper writes only `nextNodeId` and `branches[]`.
- Single selected route without conditions: Task 1 tests and Task 3 Branch Rules single-route state.
- Multiple selected routes with explicit default: Task 1 tests and Task 3 default selector.
- Last selected target becomes default: Task 1 test and Task 2 `chooseDefaultTarget`.
- Branch rules visible and editable: Task 3 Branch Rules panel.
- Edge rebuilds: Task 1 tests and Task 2 `rebuildDefaultPathEdges`.
- No runtime evaluator changes: no runtime files are in the file structure.

No placeholder work remains in this plan. All commands have expected outcomes, and every changed code surface has a matching test or manual verification step.
