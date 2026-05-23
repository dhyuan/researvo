# Flow Editor Next Nodes and Branch Rules Design

## Context

The visual Schema Flow editor currently lets a user edit one `nextNodeId` from the right-side inspector. Branch rules are stored separately in `branches[]`, and runtime traversal already follows this model:

1. Evaluate `branches[]` in order.
2. Use the first matching branch target.
3. Fall back to `nextNodeId`.
4. End traversal if neither branch nor default target resolves.

The new editing experience should make this model easier to operate visually without changing the schema format. The UI should let users select multiple possible next nodes, then configure only the nodes that need conditional routing.

## Goals

- Replace the single-select "Next node" control with a multi-target editing experience.
- Keep the existing schema model:
  - `nextNodeId` remains the default route.
  - `branches[]` remains the set of conditional routes.
- Make single-target routing simple: one selected next node does not require branch conditions.
- Make multi-target routing explicit: one selected target is default, and all other selected targets require branch rules.
- Let users choose which selected target is the default.
- Use the last newly selected target as the initial default when a node gains multiple next targets.
- Keep branch behavior visible in the Branch Rules panel.

## Non-Goals

- Do not introduce `nextNodeIds` or another schema field.
- Do not change runtime branch evaluation.
- Do not add advanced expression builders beyond the existing branch rule shape.
- Do not change graph layout or edge rendering semantics except as needed to reflect updated `nextNodeId` and `branches[]`.

## Recommended UX

### Next Nodes Control

Rename the current inspector field from "Next node" to "Next nodes".

The control should support selecting zero, one, or multiple target nodes. A checkbox list or compact multi-select is acceptable, but the selected targets must be visible without opening the control. Each option excludes the current node to prevent self-loops.

Selection behavior:

- Zero selected targets: clear `nextNodeId` and clear UI-managed branch routes for that node.
- One selected target: write that target to `nextNodeId`; no condition editor is required.
- Multiple selected targets: one target becomes the default route; every other selected target becomes a conditional branch route.

When a user selects multiple targets, the most recently selected target becomes the initial default. This gives the common workflow a natural shape: select special-case branch targets first, then select the fallback target last.

### Branch Rules Panel

The Branch Rules panel should become the detailed routing editor for the selected targets.

For one selected target:

- Show a compact summary such as `Default route: q_followup`.
- Do not show condition fields.
- Show no branch rules unless existing unrelated/manual branch rules need to be preserved during a transition period.

For multiple selected targets:

- Show a `Default route` row at the top.
- The default route row targets `nextNodeId` and has no condition fields.
- Provide a small target selector or radio affordance so the user can change which selected target is default.
- Show one conditional rule row for each selected non-default target.
- Each conditional row maps to one `branches[]` item and includes:
  - variable
  - operator
  - value, unless the operator is `exists` or `missing`
  - target node
  - remove action

If the user changes the default target:

- The new default target is written to `nextNodeId`.
- Any branch rule whose `goto` equals the new default target is removed from the conditional list.
- The previous default target remains selected. If it is still selected and is no longer default, it becomes a conditional row and must have a condition.

### Incomplete Conditional Rules

Conditional rules may be created before the user has filled every field. The UI should make incomplete rows visually clear and avoid pretending they are valid.

Recommended behavior:

- New conditional rows default to the selected node's own `variableName` when available.
- If the selected node has no usable variable, fall back to the first schema variable.
- If no variable exists, show an inline disabled/incomplete state rather than silently writing an unusable branch.
- For choice-based questions, default to `equals` and the first available option value when possible.
- For other answer-producing nodes, default to `exists` to avoid inventing a comparison value.
- Validation should continue to catch missing variables, missing targets, and invalid branch shapes.

## Data Mapping

The UI derives selected next targets from existing node data:

- Include `selectedNode.nextNodeId` when present.
- Include every unique `selectedNode.branches[].goto`.
- Exclude the selected node's own id.
- Preserve display order as:
  1. Existing branch targets in `branches[]` order.
  2. Existing `nextNodeId` as the default target.

This display order naturally puts the default last for existing schemas.

When writing updates:

- The default target is written to `nextNodeId`.
- Non-default selected targets are represented by `branches[]`.
- Existing branch rules for still-selected conditional targets should be preserved where possible.
- Deselected branch targets should be removed from `branches[]`.
- Deselected default target should clear or replace `nextNodeId` depending on the remaining selected targets.
- After any routing change, rebuild schema `edges` from `nextNodeId` and `branches[]`.

## Edge Cases

- Self-loop attempts are ignored by excluding the current node from target choices and continuing to rely on `updateNode` self-loop protection.
- If all targets are deselected, `nextNodeId` becomes undefined and `branches` becomes undefined for UI-managed routes.
- If a target node is renamed, existing `renameNodeId` behavior continues to update `nextNodeId`, `branches[].goto`, edges, and saved layout positions.
- If a node type change removes `variableName`, existing branch rules may become invalid. The UI should show incomplete branch rows and validation findings rather than deleting conditions unexpectedly.
- If multiple branch rules point to the same target, the first matching rule remains semantically meaningful. The first implementation should collapse multi-select-created routes to one conditional row per selected non-default target; manual support for multiple conditions to the same target can be revisited later.

## Component Boundary

Keep `schemaText` as the single source of truth in `SurveyMaintenanceClient`.

In `SurveyFlowEditor`, add small helper functions around routing state:

- derive selected route targets from a `QuestionNode`
- choose or update the default target
- convert selected targets plus branch edits back into a node patch

If the helper logic grows beyond simple UI glue, move it into `lib/schema/surveyNodeEditing.ts` so it can be tested independently with the existing schema editing tests.

## Validation and Testing

Add focused tests around route mapping and branch preservation:

- Selecting one target writes `nextNodeId` and no branch rules.
- Selecting multiple targets writes the default to `nextNodeId` and non-default targets to `branches[]`.
- The last newly selected target becomes default.
- Changing default moves the previous default into conditional routes.
- Deselecting a conditional target removes the matching branch.
- Deselecting the default target chooses a remaining target as the new default or clears routing if none remain.
- Existing branch rule details are preserved when their target remains selected and non-default.
- Edges are rebuilt after routing updates.

Add UI-level coverage if the existing test setup supports it:

- The inspector shows selected next nodes.
- Single-target selection hides condition fields.
- Multi-target selection shows one default row and conditional rows for the rest.

## Open Decisions

The current design assumes the multi-select UI owns the simple "one route per target" branch editing flow. If the product later needs multiple conditions that route to the same target, the Branch Rules panel can add an advanced mode without changing the schema model.
