import type { SurveySchema, VariableDefinition } from "@/lib/schema/surveySchema";
import type { ValidationFinding } from "./types";

const PII_NAME_PATTERN = /\b(email|e-mail|phone|mobile|address|street|postcode|zip|name|surname|ssn|social security|date of birth|dob|birthdate)\b/i;

const isClosedChoiceVariable = (variable: VariableDefinition) =>
  variable.type === "categorical" || variable.type === "boolean";

const isPiiLikeVariable = (variable: VariableDefinition) =>
  PII_NAME_PATTERN.test(variable.name) || PII_NAME_PATTERN.test(variable.label);

export const validateResearchMetadata = (schema: SurveySchema): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];

  schema.variables.forEach((variable, variableIndex) => {
    if (isClosedChoiceVariable(variable) && (!variable.coding || variable.coding.length === 0)) {
      findings.push({
        level: "warning",
        code: "MISSING_CODING",
        message: `Closed-choice variable "${variable.name}" is missing coding metadata.`,
        path: `variables.${variableIndex}.coding`,
        variableName: variable.name,
      });
    }

    if (variable.type === "scale" && !variable.scale) {
      findings.push({
        level: "warning",
        code: "MISSING_SCALE_METADATA",
        message: `Scale variable "${variable.name}" is missing scale metadata.`,
        path: `variables.${variableIndex}.scale`,
        variableName: variable.name,
      });
    }

    if (!variable.missingValues || variable.missingValues.length === 0) {
      findings.push({
        level: "warning",
        code: "MISSING_MISSING_VALUE_POLICY",
        message: `Variable "${variable.name}" is missing a missing-value policy.`,
        path: `variables.${variableIndex}.missingValues`,
        variableName: variable.name,
      });
    }

    if (isPiiLikeVariable(variable) && !variable.pii) {
      findings.push({
        level: "warning",
        code: "PII_FIELD_UNCLASSIFIED",
        message: `PII-like variable "${variable.name}" is missing PII classification.`,
        path: `variables.${variableIndex}.pii`,
        variableName: variable.name,
      });
    }
  });

  schema.nodes.forEach((node, nodeIndex) => {
    if (node.type === "likert" && !node.scale) {
      findings.push({
        level: "warning",
        code: "MISSING_SCALE_METADATA",
        message: `Likert node "${node.id}" is missing scale metadata.`,
        path: `nodes.${nodeIndex}.scale`,
        nodeId: node.id,
        variableName: node.variableName ?? undefined,
      });
    }
  });

  return findings;
};
