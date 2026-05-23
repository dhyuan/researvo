import type { SurveySchema } from "@/lib/schema/surveySchema";
import { validateGraph } from "./graphValidator";
import { validateResearchMetadata } from "./researchMetadataValidator";
import type { ValidationFinding, ValidationReport } from "./types";

const findDuplicates = (values: string[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }

    seen.add(value);
  });

  return duplicates;
};

const validateStructuralMetadata = (schema: SurveySchema): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];
  const duplicateNodeIds = findDuplicates(schema.nodes.map((node) => node.id));
  const duplicateVariableNames = findDuplicates(schema.variables.map((variable) => variable.name));

  schema.nodes.forEach((node, nodeIndex) => {
    if (duplicateNodeIds.has(node.id)) {
      findings.push({
        level: "error",
        code: "DUPLICATE_NODE_ID",
        message: `Node id "${node.id}" is duplicated.`,
        path: `nodes.${nodeIndex}.id`,
        nodeId: node.id,
      });
    }
  });

  schema.variables.forEach((variable, variableIndex) => {
    if (duplicateVariableNames.has(variable.name)) {
      findings.push({
        level: "error",
        code: "DUPLICATE_VARIABLE_NAME",
        message: `Variable name "${variable.name}" is duplicated.`,
        path: `variables.${variableIndex}.name`,
        variableName: variable.name,
      });
    }
  });

  return findings;
};

export const validateSurveySchema = (schema: SurveySchema): ValidationReport => {
  const findings = [
    ...validateStructuralMetadata(schema),
    ...validateGraph(schema),
    ...validateResearchMetadata(schema),
  ];

  return {
    schemaVersion: "0.0.1",
    hasBlockingErrors: findings.some((finding) => finding.level === "error"),
    findings,
  };
};
