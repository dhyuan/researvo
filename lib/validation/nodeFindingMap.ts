import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationFinding } from "@/lib/validation/types";

export type NodeSeverity = "error" | "warning" | "suggestion" | null;

const nodePathPattern = /^nodes\.(\d+)(\.|$)/;

export const getFindingNodeId = (schema: SurveySchema, finding: ValidationFinding): string | null => {
  if (finding.nodeId) {
    return finding.nodeId;
  }

  const match = finding.path.match(nodePathPattern);

  if (!match) {
    return null;
  }

  const nodeIndex = Number(match[1]);

  return schema.nodes[nodeIndex]?.id ?? null;
};

export const groupFindingsByNode = (schema: SurveySchema, findings: ValidationFinding[]) => {
  const grouped = new Map<string, ValidationFinding[]>();

  findings.forEach((finding) => {
    const nodeId = getFindingNodeId(schema, finding);

    if (!nodeId) {
      return;
    }

    grouped.set(nodeId, [...(grouped.get(nodeId) ?? []), finding]);
  });

  return grouped;
};

export const getNodeSeverity = (findings: ValidationFinding[]): NodeSeverity => {
  if (findings.some((finding) => finding.level === "error")) {
    return "error";
  }

  if (findings.some((finding) => finding.level === "warning")) {
    return "warning";
  }

  if (findings.some((finding) => finding.level === "suggestion")) {
    return "suggestion";
  }

  return null;
};
