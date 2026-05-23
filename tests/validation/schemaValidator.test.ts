import { describe, expect, it } from "vitest";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";

describe("validateSurveySchema", () => {
  it("returns no errors for the example schema", () => {
    const report = validateSurveySchema(exampleSurveySchema);

    expect(report.hasBlockingErrors).toBe(false);
    expect(report.findings.filter((finding) => finding.level === "error")).toHaveLength(0);
  });

  it("blocks publish when a branch target is missing", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: exampleSurveySchema.nodes.map((node) =>
        node.id === "q_gender" ? { ...node, nextNodeId: "missing_node" } : node,
      ),
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "INVALID_BRANCH_TARGET")).toBe(true);
  });

  it("warns when a closed choice variable lacks coding", () => {
    const schema = {
      ...exampleSurveySchema,
      variables: [{ ...exampleSurveySchema.variables[0], coding: [] }],
    };

    const report = validateSurveySchema(schema);

    expect(report.findings.some((finding) => finding.code === "MISSING_CODING")).toBe(true);
  });

  it("blocks publish when node IDs are duplicated", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: [...exampleSurveySchema.nodes, { ...exampleSurveySchema.nodes[0] }],
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "DUPLICATE_NODE_ID")).toBe(true);
  });

  it("blocks publish when variable names are duplicated", () => {
    const schema = {
      ...exampleSurveySchema,
      variables: [...exampleSurveySchema.variables, { ...exampleSurveySchema.variables[0] }],
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "DUPLICATE_VARIABLE_NAME")).toBe(true);
  });

  it("warns when a node is unreachable", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: [
        ...exampleSurveySchema.nodes,
        { id: "q_hidden", type: "short_text" as const, title: "Hidden", variableName: "hidden" },
      ],
      variables: [
        ...exampleSurveySchema.variables,
        {
          name: "hidden",
          label: "Hidden",
          type: "text" as const,
          questionNodeId: "q_hidden",
          missingValues: [{ reason: "not_shown" as const, value: null }],
        },
      ],
    };

    const report = validateSurveySchema(schema);

    expect(report.findings.some((finding) => finding.code === "UNREACHABLE_NODE")).toBe(true);
  });

  it("warns when a PII-like variable lacks classification", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: [
        ...exampleSurveySchema.nodes,
        { id: "q_email", type: "short_text" as const, title: "Email", variableName: "email" },
      ],
      variables: [
        ...exampleSurveySchema.variables,
        {
          name: "email",
          label: "Email address",
          type: "text" as const,
          questionNodeId: "q_email",
          missingValues: [{ reason: "not_shown" as const, value: null }],
        },
      ],
      edges: [...exampleSurveySchema.edges, { from: "end", to: "q_email" }],
    };

    const report = validateSurveySchema(schema);

    expect(report.findings.some((finding) => finding.code === "PII_FIELD_UNCLASSIFIED")).toBe(true);
  });

  it("warns when a node is connected only by an edge from a terminal node", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: [
        ...exampleSurveySchema.nodes,
        { id: "q_after_end", type: "short_text" as const, title: "After end", variableName: "after_end" },
      ],
      variables: [
        ...exampleSurveySchema.variables,
        {
          name: "after_end",
          label: "After end",
          type: "text" as const,
          questionNodeId: "q_after_end",
          missingValues: [{ reason: "not_shown" as const, value: null }],
        },
      ],
      edges: [...exampleSurveySchema.edges, { from: "end", to: "q_after_end" }],
    };

    const report = validateSurveySchema(schema);

    expect(
      report.findings.some(
        (finding) => finding.code === "UNREACHABLE_NODE" && finding.nodeId === "q_after_end",
      ),
    ).toBe(true);
  });

  it("blocks publish when a branch references an unknown variable", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: exampleSurveySchema.nodes.map((node) =>
        node.id === "q_gender"
          ? {
              ...node,
              branches: [
                {
                  variableName: "unknown_variable",
                  operator: "equals" as const,
                  value: 1,
                  goto: "end",
                },
              ],
            }
          : node,
      ),
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "INVALID_BRANCH_VARIABLE")).toBe(true);
  });

  it("blocks publish when a node references an unknown variable", () => {
    const schema = {
      ...exampleSurveySchema,
      nodes: exampleSurveySchema.nodes.map((node) =>
        node.id === "q_gender" ? { ...node, variableName: "unknown_variable" } : node,
      ),
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "INVALID_NODE_VARIABLE")).toBe(true);
  });

  it("blocks publish when a variable references an unknown question node", () => {
    const schema = {
      ...exampleSurveySchema,
      variables: [{ ...exampleSurveySchema.variables[0], questionNodeId: "unknown_node" }],
    };

    const report = validateSurveySchema(schema);

    expect(report.hasBlockingErrors).toBe(true);
    expect(report.findings.some((finding) => finding.code === "INVALID_VARIABLE_NODE")).toBe(true);
  });
});
