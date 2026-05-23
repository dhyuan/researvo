# Flow Editor UI Polish Design

## Context

The flow editor now supports multi-target routing and branch rule editing. The next pass should improve the editing surface without changing schema semantics, runtime traversal, branch rule behavior, or persistence format.

## Goals

- Make flow node cards visually complete and easier to scan.
- Remove low-value `required` badges from node cards.
- Improve variable name contrast on node cards.
- Add a clear selected-node state in the graph.
- Let desktop users resize the graph/editor split with the mouse.
- Make Answer Options editing more compact while keeping labels readable.
- Keep the `required` control in the inspector, because it is still an editable respondent behavior.

## Design Decisions

### Node Cards

Node cards should use complete, closed surfaces for all preview rows. The current right-side broken-border impression should be removed by giving preview items a full border and background rather than partial-looking blocks.

Cards show:

- title
- entry badge when applicable
- variable name when present
- answer preview rows
- validation badge when there are findings

Cards do not show:

- `required`

The variable badge should use stronger contrast: darker text, white or subtly tinted background, and a real border. It remains monospace.

### Selected State

When a node is selected, its React Flow node should show a stronger visual state:

- 2px primary border
- slightly stronger shadow
- a subtle tinted background on the card surface or wrapper

This should be independent of validation severity. If the selected node also has an error/warning, severity still controls the top bar and badge, but the selected border should remain obvious.

### Resizable Split

The desktop layout should support dragging a vertical divider between graph and inspector.

Behavior:

- Works at `xl` sizes where the two-column layout is active.
- Keeps the graph column at or above a reasonable minimum width.
- Keeps the inspector at or above a reasonable minimum width.
- Does not write layout width to the schema.
- Local component state is enough for this pass.
- Fullscreen uses the same resizing behavior with a taller canvas.

Mobile and smaller breakpoints can keep the existing stacked/single-column behavior.

### Answer Options Editor

Each option should remain a compact card, but the fields should use two horizontal rows:

```text
Label  [long input]
Value  [short input] [Remove]
```

This is intentionally not a single-row layout. The label text and its input sit on one line; the value text, shorter value input, and remove action sit on the next line.

The value input should have a fixed compact width, while the label input uses the remaining horizontal space.

### Required Control

The `required` property should remain visible in the right-side inspector because it changes respondent behavior and users need to edit it. It should not appear on graph node cards.

For branch decision nodes, the disabled state and short explanatory text should remain.

## Non-Goals

- No schema format changes.
- No branch rule behavior changes.
- No runtime traversal changes.
- No persistence of split pane width.
- No broad redesign of the survey maintenance page.

## Verification

- Node cards render without broken-looking right-side borders.
- `required` no longer appears on graph cards.
- Variable name is readable on graph cards.
- Selected card has a visible selected state.
- Dragging the split handle changes graph/editor widths on desktop.
- Answer Options use the two-row compact layout.
- Existing route editing behavior still works.
- `npm test`, `npm run lint`, and `npm run build` pass.
