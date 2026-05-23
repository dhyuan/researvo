import { describe, expect, it } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import type { SurveySchema } from "@/lib/schema/surveySchema";
import { getDefaultFlowNodePositions, getSavedFlowNodePosition, withDefaultFlowNodePositions, withFlowNodePositions } from "@/lib/schema/surveyFlowLayout";

const cloneSchema = (schema: SurveySchema = exampleSurveySchema): SurveySchema => structuredClone(schema);

describe("survey flow layout", () => {
  it("stores flow node positions in schema metadata", () => {
    const schema = withFlowNodePositions(cloneSchema(), [
      { id: "consent", position: { x: 120, y: 80 } },
      { id: "q_gender", position: { x: 420, y: 220 } },
    ]);

    expect(schema.metadata.flowLayout).toEqual({
      nodes: {
        consent: { x: 120, y: 80 },
        q_gender: { x: 420, y: 220 },
      },
    });
  });

  it("reads saved positions", () => {
    const schema = withFlowNodePositions(cloneSchema(), [{ id: "q_gender", position: { x: 420, y: 220 } }]);

    expect(getSavedFlowNodePosition(schema, "q_gender")).toEqual({ x: 420, y: 220 });
    expect(getSavedFlowNodePosition(schema, "end")).toBeNull();
  });

  it("creates a vertical default layout from graph depth", () => {
    const schema = cloneSchema();
    const positions = getDefaultFlowNodePositions(schema);

    expect(positions.get("consent")).toEqual({ x: 0, y: 0 });
    expect(positions.get("q_gender")).toEqual({ x: 0, y: 260 });
    expect(positions.get("end")).toEqual({ x: 0, y: 520 });
  });

  it("spreads branches horizontally and places merged nodes below them", () => {
    const base = cloneSchema();
    const schema: SurveySchema = {
      ...base,
      survey: { ...base.survey, entryNodeId: "start" },
      variables: [
        { name: "path", label: "Path", type: "categorical", questionNodeId: "branch" },
        { name: "merged", label: "Merged", type: "text", questionNodeId: "merge" },
      ],
      nodes: [
        { id: "start", type: "consent", title: "Start", variableName: null, nextNodeId: "branch" },
        {
          id: "branch",
          type: "single_choice",
          title: "Choose path",
          variableName: "path",
          options: [
            { id: "a", label: "A", value: "a" },
            { id: "b", label: "B", value: "b" },
          ],
          branches: [
            { variableName: "path", operator: "equals", value: "a", goto: "path_a" },
            { variableName: "path", operator: "equals", value: "b", goto: "path_b" },
          ],
        },
        { id: "path_a", type: "short_text", title: "A", variableName: "a", nextNodeId: "merge" },
        { id: "path_b", type: "short_text", title: "B", variableName: "b", nextNodeId: "merge" },
        { id: "merge", type: "short_text", title: "Merge", variableName: "merged", nextNodeId: "end" },
        { id: "end", type: "terminal", title: "End", variableName: null },
      ],
      edges: [],
    };

    const positions = getDefaultFlowNodePositions(schema);

    expect(positions.get("start")).toEqual({ x: 0, y: 0 });
    expect(positions.get("branch")).toEqual({ x: 0, y: 260 });
    expect(positions.get("path_a")).toEqual({ x: -180, y: 520 });
    expect(positions.get("path_b")).toEqual({ x: 180, y: 520 });
    expect(positions.get("merge")).toEqual({ x: 0, y: 780 });
    expect(positions.get("end")).toEqual({ x: 0, y: 1040 });
  });

  it("resets saved node positions to the default layout", () => {
    const draggedSchema = withFlowNodePositions(cloneSchema(), [
      { id: "consent", position: { x: 500, y: 90 } },
      { id: "q_gender", position: { x: -300, y: 420 } },
      { id: "end", position: { x: 240, y: 780 } },
    ]);

    const schema = withDefaultFlowNodePositions(draggedSchema);

    expect(schema.metadata.flowLayout).toEqual({
      nodes: {
        consent: { x: 0, y: 0 },
        q_gender: { x: 0, y: 260 },
        end: { x: 0, y: 520 },
      },
    });
  });

  it("ignores malformed saved positions", () => {
    const schema: SurveySchema = {
      ...cloneSchema(),
      metadata: {
        flowLayout: {
          nodes: {
            consent: { x: "left", y: 100 },
          },
        },
      },
    };

    expect(getSavedFlowNodePosition(schema, "consent")).toBeNull();
  });
});
