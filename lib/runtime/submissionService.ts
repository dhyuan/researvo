import type { SurveySchema } from "@/lib/schema/surveySchema";

export type RawSubmissionInput = {
  schema: SurveySchema;
  answers: Record<string, unknown>;
  shownNodeIds: string[];
  branchPath: string[];
};

export type NormalizedSubmission = {
  answers: Record<string, unknown>;
  shownNodeIds: string[];
  branchPath: string[];
  missingValues: Record<string, string>;
};

const optionValuesForVariable = (schema: SurveySchema, variableName: string) => {
  const node = schema.nodes.find((candidate) => candidate.variableName === variableName);

  return new Set<unknown>(node?.options?.map((option) => option.value) ?? []);
};

const isClosedChoiceVariable = (schema: SurveySchema, variableName: string) => optionValuesForVariable(schema, variableName).size > 0;

const normalizeAnswerValue = (schema: SurveySchema, variableName: string, value: unknown) => {
  if (!isClosedChoiceVariable(schema, variableName)) {
    return value;
  }

  const optionValues = optionValuesForVariable(schema, variableName);

  if (Array.isArray(value)) {
    return value.filter((item) => optionValues.has(item));
  }

  return optionValues.has(value) ? value : undefined;
};

export const normalizeSubmission = ({
  schema,
  answers,
  shownNodeIds,
  branchPath,
}: RawSubmissionInput): NormalizedSubmission => {
  const normalizedAnswers: Record<string, unknown> = {};
  const missingValues: Record<string, string> = {};

  for (const variable of schema.variables) {
    const wasShown = variable.questionNodeId ? shownNodeIds.includes(variable.questionNodeId) : true;
    const rawValue = answers[variable.name];
    const normalizedValue = normalizeAnswerValue(schema, variable.name, rawValue);

    if (!wasShown) {
      missingValues[variable.name] = "not_shown";
      continue;
    }

    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === "") {
      missingValues[variable.name] = "skipped";
      continue;
    }

    normalizedAnswers[variable.name] = normalizedValue;
  }

  return {
    answers: normalizedAnswers,
    shownNodeIds: [...shownNodeIds],
    branchPath: [...branchPath],
    missingValues,
  };
};
