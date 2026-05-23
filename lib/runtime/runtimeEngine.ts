import type { BranchRule, QuestionNode, SurveyPolicy, SurveySchema } from "@/lib/schema/surveySchema";
import { startAnonymousAccess } from "./accessGate";

export { startAnonymousAccess };

export type RuntimeAnswers = Record<string, unknown>;

export type GetNextNodeInput = {
  schema: SurveySchema;
  currentNodeId: string;
  answers: RuntimeAnswers;
};

export type RuntimeTraversalResult =
  | { ok: true; currentNode: QuestionNode; nextNode: QuestionNode | null }
  | { ok: false; code: "CURRENT_NODE_NOT_FOUND" | "NEXT_NODE_NOT_FOUND"; nodeId: string };

const scalarEquals = (left: unknown, right: unknown) => Object.is(left, right);

const hasAnswer = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && value !== null && value !== "";
};

const branchMatches = (branch: BranchRule, answers: RuntimeAnswers) => {
  const answer = answers[branch.variableName];

  switch (branch.operator) {
    case "equals":
      return scalarEquals(answer, branch.value);
    case "not_equals":
      return !scalarEquals(answer, branch.value);
    case "in":
      return branch.value.some((value) => scalarEquals(answer, value));
    case "not_in":
      return !branch.value.some((value) => scalarEquals(answer, value));
    case "exists":
      return hasAnswer(answer);
    case "missing":
      return !hasAnswer(answer);
  }
};

const findNode = (schema: SurveySchema, nodeId: string) => schema.nodes.find((node) => node.id === nodeId);

const resolveNextNodeId = (currentNode: QuestionNode, answers: RuntimeAnswers) => {
  const matchingBranch = currentNode.branches?.find((branch) => branchMatches(branch, answers));

  return matchingBranch?.goto ?? currentNode.nextNodeId ?? null;
};

export const getNextNode = ({ schema, currentNodeId, answers }: GetNextNodeInput): RuntimeTraversalResult => {
  const currentNode = findNode(schema, currentNodeId);

  if (!currentNode) {
    return { ok: false, code: "CURRENT_NODE_NOT_FOUND", nodeId: currentNodeId };
  }

  if (currentNode.type === "terminal") {
    return { ok: true, currentNode, nextNode: null };
  }

  const nextNodeId = resolveNextNodeId(currentNode, answers);

  if (!nextNodeId) {
    return { ok: true, currentNode, nextNode: null };
  }

  const nextNode = findNode(schema, nextNodeId);

  if (!nextNode) {
    return { ok: false, code: "NEXT_NODE_NOT_FOUND", nodeId: nextNodeId };
  }

  return { ok: true, currentNode, nextNode };
};

export type { SurveyPolicy };
