import type {
  Edge,
  Option,
  QuestionNode,
  SurveySchema,
  VariableDefinition,
} from "@/lib/schema/surveySchema";
import { renameFlowNodePosition } from "@/lib/schema/surveyFlowLayout";

type QuestionType = QuestionNode["type"];

type CreateNodeOptions = {
  id?: string;
  title?: string;
  type?: QuestionType;
};

const answerProducingTypes = new Set<QuestionType>([
  "single_choice",
  "multiple_choice",
  "short_text",
  "long_text",
  "number",
  "likert",
]);

const optionTypes = new Set<QuestionType>(["single_choice", "multiple_choice", "likert"]);

const sanitizedId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

const replaceNodeReference = (value: string | undefined, oldId: string, newId: string) =>
  value === oldId ? newId : value;

const assertNodeExists = (schema: SurveySchema, nodeId: string) => {
  const node = schema.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new Error(`Node "${nodeId}" does not exist`);
  }

  return node;
};

export const nodeTypeUsesOptions = (type: QuestionType) => optionTypes.has(type);

export const nodeTypeUsesVariable = (type: QuestionType) => answerProducingTypes.has(type);

export const isBranchDecisionNode = (node: QuestionNode) =>
  Boolean(node.variableName && node.branches?.some((branch) => branch.variableName === node.variableName));

const defaultOptions = (type: QuestionType): Option[] => {
  if (type === "likert") {
    return [
      { id: "strongly_disagree", label: "Strongly disagree", value: 1 },
      { id: "disagree", label: "Disagree", value: 2 },
      { id: "neutral", label: "Neutral", value: 3 },
      { id: "agree", label: "Agree", value: 4 },
      { id: "strongly_agree", label: "Strongly agree", value: 5 },
    ];
  }

  return [
    { id: "option_1", label: "Option 1", value: "option_1" },
    { id: "option_2", label: "Option 2", value: "option_2" },
  ];
};

const variableTypeForNode = (type: QuestionType): VariableDefinition["type"] => {
  switch (type) {
    case "single_choice":
    case "multiple_choice":
      return "categorical";
    case "short_text":
    case "long_text":
      return "text";
    case "number":
      return "numeric";
    case "likert":
      return "scale";
    case "consent":
    case "terminal":
      return "text";
  }
};

const variableForNode = (node: QuestionNode): VariableDefinition | null => {
  if (!nodeTypeUsesVariable(node.type) || !node.variableName) {
    return null;
  }

  return {
    name: node.variableName,
    label: node.title,
    type: variableTypeForNode(node.type),
    questionNodeId: node.id,
    required: node.required,
    coding: node.options?.map((option) => ({
      label: option.label,
      value: option.value,
      missing: option.missing,
      metadata: option.metadata,
    })),
    scale: node.scale,
    pii: node.pii,
  };
};

const upsertVariableForNode = (schema: SurveySchema, node: QuestionNode, previousVariableName?: string | null): SurveySchema => {
  const nextVariable = variableForNode(node);
  const matchesNode = (variable: VariableDefinition) =>
    variable.questionNodeId === node.id || Boolean(previousVariableName && variable.name === previousVariableName);

  if (!nextVariable) {
    return {
      ...schema,
      variables: schema.variables.filter((variable) => !matchesNode(variable)),
    };
  }

  const hasExisting = schema.variables.some(matchesNode);

  return {
    ...schema,
    variables: hasExisting
      ? schema.variables.map((variable) => (matchesNode(variable) ? { ...variable, ...nextVariable } : variable))
      : [...schema.variables, nextVariable],
  };
};

export const createUniqueNodeId = (schema: SurveySchema, base: string) => {
  const normalizedBase = sanitizedId(base) || "q_new";
  const nodeIds = new Set(schema.nodes.map((node) => node.id));

  if (!nodeIds.has(normalizedBase)) {
    return normalizedBase;
  }

  let suffix = 2;
  let candidate = `${normalizedBase}_${suffix}`;

  while (nodeIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}_${suffix}`;
  }

  return candidate;
};

export const normalizeNodeForType = (node: QuestionNode): QuestionNode => {
  const nextNode: QuestionNode = { ...node };

  if (nodeTypeUsesVariable(nextNode.type)) {
    nextNode.variableName = nextNode.variableName || sanitizedId(nextNode.id) || nextNode.id;
  } else {
    nextNode.variableName = null;
    delete nextNode.required;
  }

  if (nodeTypeUsesOptions(nextNode.type)) {
    nextNode.options = nextNode.options?.length ? nextNode.options : defaultOptions(nextNode.type);
  } else {
    delete nextNode.options;
  }

  if (nextNode.type !== "likert") {
    delete nextNode.scale;
  }

  if (isBranchDecisionNode(nextNode)) {
    nextNode.required = true;
  }

  return nextNode;
};

export const renameNodeId = (schema: SurveySchema, oldId: string, newId: string): SurveySchema => {
  const normalizedNewId = newId.trim();

  if (!normalizedNewId) {
    throw new Error("Node ID is required");
  }

  if (oldId === normalizedNewId) {
    return schema;
  }

  assertNodeExists(schema, oldId);

  if (schema.nodes.some((node) => node.id === normalizedNewId)) {
    throw new Error("Node ID already exists");
  }

  return renameFlowNodePosition({
    ...schema,
    survey: {
      ...schema.survey,
      entryNodeId: schema.survey.entryNodeId === oldId ? normalizedNewId : schema.survey.entryNodeId,
    },
    nodes: schema.nodes.map((node) => ({
      ...node,
      id: node.id === oldId ? normalizedNewId : node.id,
      nextNodeId: replaceNodeReference(node.nextNodeId, oldId, normalizedNewId),
      branches: node.branches?.map((branch) => ({
        ...branch,
        goto: branch.goto === oldId ? normalizedNewId : branch.goto,
      })),
    })),
    edges: schema.edges.map((edge) => ({
      ...edge,
      from: edge.from === oldId ? normalizedNewId : edge.from,
      to: edge.to === oldId ? normalizedNewId : edge.to,
    })),
    variables: schema.variables.map((variable) => ({
      ...variable,
      questionNodeId: variable.questionNodeId === oldId ? normalizedNewId : variable.questionNodeId,
    })),
  }, oldId, normalizedNewId);
};

export const updateNode = (schema: SurveySchema, nodeId: string, patch: Partial<QuestionNode>): SurveySchema => {
  const currentNode = assertNodeExists(schema, nodeId);
  const previousVariableName = currentNode.variableName;
  // Prevent a node from pointing to itself as the next node (self-loop).
  const safePatch = { ...patch };
  if (safePatch.nextNodeId === nodeId) {
    // Ignore self-referential nextNodeId to avoid accidental self-loops.
    // Leave nextNodeId undefined so it will be cleared.
    (safePatch as Partial<QuestionNode>).nextNodeId = undefined;
  }

  const patchedNode = normalizeNodeForType({ ...currentNode, ...safePatch } as QuestionNode);
  const schemaWithNode = {
    ...schema,
    nodes: schema.nodes.map((node) => (node.id === nodeId ? patchedNode : node)),
  };

  return upsertVariableForNode(schemaWithNode, patchedNode, previousVariableName);
};

export const createQuestionNode = (schema: SurveySchema, options: CreateNodeOptions = {}): QuestionNode => {
  const id = options.id?.trim() || createUniqueNodeId(schema, "q_new");
  const type = options.type ?? "short_text";
  const node: QuestionNode = {
    id,
    type,
    title: options.title ?? "New question",
    variableName: nodeTypeUsesVariable(type) ? sanitizedId(id) || id : null,
  };

  return normalizeNodeForType(node);
};

export const rebuildDefaultPathEdges = (schema: SurveySchema): SurveySchema => ({
  ...schema,
  edges: schema.nodes.flatMap((node): Edge[] => {
    const edges: Edge[] = [];

    if (node.nextNodeId) {
      edges.push({ from: node.id, to: node.nextNodeId });
    }

    node.branches?.forEach((branch) => {
      edges.push({ from: node.id, to: branch.goto, condition: branch });
    });

    return edges;
  }),
});

export const insertNodeBefore = (schema: SurveySchema, targetNodeId: string, options: CreateNodeOptions = {}): SurveySchema => {
  const targetNode = assertNodeExists(schema, targetNodeId);

  if (targetNode.id === schema.survey.entryNodeId) {
    throw new Error("Cannot insert before entry node");
  }

  const newNode = { ...createQuestionNode(schema, options), nextNodeId: targetNode.id };
  const targetIndex = schema.nodes.findIndex((node) => node.id === targetNode.id);
  const nodesWithRedirects = schema.nodes.map((node) => ({
    ...node,
    nextNodeId: node.nextNodeId === targetNode.id ? newNode.id : node.nextNodeId,
    branches: node.branches?.map((branch) => ({
      ...branch,
      goto: branch.goto === targetNode.id ? newNode.id : branch.goto,
    })),
  }));
  const nextSchema = {
    ...schema,
    nodes: [...nodesWithRedirects.slice(0, targetIndex), newNode, ...nodesWithRedirects.slice(targetIndex)],
  };

  return upsertVariableForNode(rebuildDefaultPathEdges(nextSchema), newNode);
};

export const addNodeAfter = (schema: SurveySchema, sourceNodeId: string, options: CreateNodeOptions = {}): SurveySchema => {
  const sourceNode = assertNodeExists(schema, sourceNodeId);

  if (sourceNode.type === "terminal") {
    throw new Error("Cannot add after terminal node");
  }

  const newNode = { ...createQuestionNode(schema, options), nextNodeId: sourceNode.nextNodeId };
  const sourceIndex = schema.nodes.findIndex((node) => node.id === sourceNode.id);
  const nextSchema = {
    ...schema,
    nodes: schema.nodes.flatMap((node, index) => {
      if (index !== sourceIndex) {
        return [node];
      }

      return [{ ...node, nextNodeId: newNode.id }, newNode];
    }),
  };

  return upsertVariableForNode(rebuildDefaultPathEdges(nextSchema), newNode);
};
