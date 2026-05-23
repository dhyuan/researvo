import type { SurveySchema } from "@/lib/schema/surveySchema";

export type FlowNodePosition = {
  x: number;
  y: number;
};

export type FlowNodePositionEntry = {
  id: string;
  position: FlowNodePosition;
};

type FlowLayoutMetadata = {
  nodes?: Record<string, unknown>;
};

const verticalLayerGap = 260;
const horizontalNodeGap = 360;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

const isFlowNodePosition = (value: unknown): value is FlowNodePosition =>
  isRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);

const getFlowLayoutMetadata = (schema: SurveySchema): FlowLayoutMetadata | null => {
  const flowLayout = schema.metadata.flowLayout;

  return isRecord(flowLayout) ? flowLayout : null;
};

export const defaultFlowNodePosition = (index: number): FlowNodePosition => ({
  x: 0,
  y: index * verticalLayerGap,
});

const getOutgoingNodeIds = (schema: SurveySchema, nodeId: string) => {
  const node = schema.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return [];
  }

  return [node.nextNodeId, ...(node.branches?.map((branch) => branch.goto) ?? [])].filter((target): target is string => Boolean(target));
};

export const getDefaultFlowNodePositions = (schema: SurveySchema): Map<string, FlowNodePosition> => {
  const nodeIds = new Set(schema.nodes.map((node) => node.id));
  const depths = new Map<string, number>();
  const queue = nodeIds.has(schema.survey.entryNodeId) ? [{ id: schema.survey.entryNodeId, depth: 0 }] : [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const previousDepth = depths.get(current.id);

    if (previousDepth !== undefined && previousDepth >= current.depth) {
      continue;
    }

    depths.set(current.id, current.depth);

    getOutgoingNodeIds(schema, current.id).forEach((targetId) => {
      if (nodeIds.has(targetId) && targetId !== current.id) {
        queue.push({ id: targetId, depth: current.depth + 1 });
      }
    });
  }

  let fallbackDepth = Math.max(0, ...depths.values()) + 1;

  schema.nodes.forEach((node) => {
    if (!depths.has(node.id)) {
      depths.set(node.id, fallbackDepth);
      fallbackDepth += 1;
    }
  });

  const layers = new Map<number, string[]>();

  schema.nodes.forEach((node) => {
    const depth = depths.get(node.id) ?? 0;
    const layer = layers.get(depth) ?? [];
    layer.push(node.id);
    layers.set(depth, layer);
  });

  const positions = new Map<string, FlowNodePosition>();

  layers.forEach((nodeIdsInLayer, depth) => {
    nodeIdsInLayer.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: (index - (nodeIdsInLayer.length - 1) / 2) * horizontalNodeGap,
        y: depth * verticalLayerGap,
      });
    });
  });

  return positions;
};

export const getSavedFlowNodePosition = (schema: SurveySchema, nodeId: string): FlowNodePosition | null => {
  const nodes = getFlowLayoutMetadata(schema)?.nodes;

  if (!isRecord(nodes)) {
    return null;
  }

  const position = nodes[nodeId];

  return isFlowNodePosition(position) ? position : null;
};

export const withFlowNodePositions = (schema: SurveySchema, positions: FlowNodePositionEntry[]): SurveySchema => {
  const nodeIds = new Set(schema.nodes.map((node) => node.id));
  const nodes = Object.fromEntries(
    positions
      .filter((entry) => nodeIds.has(entry.id))
      .map((entry) => [entry.id, { x: entry.position.x, y: entry.position.y }]),
  );

  return {
    ...schema,
    metadata: {
      ...schema.metadata,
      flowLayout: { nodes },
    },
  };
};

export const withDefaultFlowNodePositions = (schema: SurveySchema): SurveySchema => {
  const defaultPositions = getDefaultFlowNodePositions(schema);

  return withFlowNodePositions(
    schema,
    schema.nodes.map((node, index) => ({
      id: node.id,
      position: defaultPositions.get(node.id) ?? defaultFlowNodePosition(index),
    })),
  );
};

export const renameFlowNodePosition = (schema: SurveySchema, oldId: string, newId: string): SurveySchema => {
  const flowLayout = getFlowLayoutMetadata(schema);
  const nodes = flowLayout?.nodes;

  if (!isRecord(nodes) || !(oldId in nodes)) {
    return schema;
  }

  const nextNodes = { ...nodes };
  nextNodes[newId] = nextNodes[oldId];
  delete nextNodes[oldId];

  return {
    ...schema,
    metadata: {
      ...schema.metadata,
      flowLayout: {
        ...flowLayout,
        nodes: nextNodes,
      },
    },
  };
};
