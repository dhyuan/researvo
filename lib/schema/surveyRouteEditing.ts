import type {
  BranchRule,
  QuestionNode,
  SurveySchema,
} from "@/lib/schema/surveySchema";
import {
  nodeTypeUsesOptions,
  rebuildDefaultPathEdges,
  updateNode,
} from "@/lib/schema/surveyNodeEditing";

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
  const selectedTargetIds = unique([
    ...branchTargetIds,
    node.nextNodeId ?? "",
  ]).filter((targetId) => targetId !== node.id);

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

const chooseDefaultTarget = (
  currentNode: QuestionNode,
  input: ApplyRouteTargetsInput,
) => {
  if (input.selectedTargetIds.length === 0) {
    return undefined;
  }

  if (
    input.addedTargetId &&
    input.selectedTargetIds.includes(input.addedTargetId)
  ) {
    return input.addedTargetId;
  }

  if (
    input.defaultTargetId &&
    input.selectedTargetIds.includes(input.defaultTargetId)
  ) {
    return input.defaultTargetId;
  }

  if (
    currentNode.nextNodeId &&
    input.selectedTargetIds.includes(currentNode.nextNodeId)
  ) {
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
  const selectedTargetIds = unique(input.selectedTargetIds).filter(
    (targetId) => targetId !== nodeId,
  );
  const defaultTargetId = chooseDefaultTarget(currentNode, {
    ...input,
    selectedTargetIds,
  });

  if (selectedTargetIds.length === 0) {
    const cleared = updateNode(schema, nodeId, {
      nextNodeId: undefined,
      branches: undefined,
    });

    return rebuildDefaultPathEdges(cleared);
  }

  const existingBranchByTarget = new Map(
    (currentNode.branches ?? []).map((branch) => [branch.goto, branch]),
  );
  const conditionalTargetIds = selectedTargetIds.filter(
    (targetId) => targetId !== defaultTargetId,
  );
  const branches = conditionalTargetIds
    .map(
      (targetId) =>
        existingBranchByTarget.get(targetId) ??
        createDefaultBranchRule(schema, currentNode, targetId),
    )
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

  return rebuildDefaultPathEdges(
    updateNode(schema, nodeId, {
      branches: branches.length ? branches : undefined,
    }),
  );
};

export const removeBranchRule = (
  schema: SurveySchema,
  nodeId: string,
  branchIndex: number,
): SurveySchema => {
  const currentNode = findNode(schema, nodeId);
  const branches = [...(currentNode.branches ?? [])];

  branches.splice(branchIndex, 1);

  return rebuildDefaultPathEdges(
    updateNode(schema, nodeId, {
      branches: branches.length ? branches : undefined,
    }),
  );
};
