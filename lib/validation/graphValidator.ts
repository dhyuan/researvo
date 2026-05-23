import type { SurveySchema } from "@/lib/schema/surveySchema";
import type { ValidationFinding } from "./types";

const addEdge = (graph: Map<string, Set<string>>, from: string, to: string) => {
  const targets = graph.get(from) ?? new Set<string>();
  targets.add(to);
  graph.set(from, targets);
};

export const validateGraph = (schema: SurveySchema): ValidationFinding[] => {
  const findings: ValidationFinding[] = [];
  const nodeIds = new Set(schema.nodes.map((node) => node.id));
  const variableNames = new Set(schema.variables.map((variable) => variable.name));

  if (!nodeIds.has(schema.survey.entryNodeId)) {
    findings.push({
      level: "error",
      code: "MISSING_ENTRY_NODE",
      message: `Entry node "${schema.survey.entryNodeId}" does not exist.`,
      path: "survey.entryNodeId",
      nodeId: schema.survey.entryNodeId,
    });
  }

  schema.nodes.forEach((node, nodeIndex) => {
    if (node.variableName && !variableNames.has(node.variableName)) {
      findings.push({
        level: "error",
        code: "INVALID_NODE_VARIABLE",
        message: `Node "${node.id}" references missing variable "${node.variableName}".`,
        path: `nodes.${nodeIndex}.variableName`,
        nodeId: node.id,
        variableName: node.variableName,
      });
    }

    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
      findings.push({
        level: "error",
        code: "INVALID_BRANCH_TARGET",
        message: `Node "${node.id}" points to missing node "${node.nextNodeId}".`,
        path: `nodes.${nodeIndex}.nextNodeId`,
        nodeId: node.id,
      });
    }

    node.branches?.forEach((branch, branchIndex) => {
      if (!variableNames.has(branch.variableName)) {
        findings.push({
          level: "error",
          code: "INVALID_BRANCH_VARIABLE",
          message: `Branch from node "${node.id}" references missing variable "${branch.variableName}".`,
          path: `nodes.${nodeIndex}.branches.${branchIndex}.variableName`,
          nodeId: node.id,
          variableName: branch.variableName,
        });
      }

      if (!nodeIds.has(branch.goto)) {
        findings.push({
          level: "error",
          code: "INVALID_BRANCH_TARGET",
          message: `Branch from node "${node.id}" points to missing node "${branch.goto}".`,
          path: `nodes.${nodeIndex}.branches.${branchIndex}.goto`,
          nodeId: node.id,
          variableName: branch.variableName,
        });
      }
    });
  });

  schema.variables.forEach((variable, variableIndex) => {
    if (variable.questionNodeId && !nodeIds.has(variable.questionNodeId)) {
      findings.push({
        level: "error",
        code: "INVALID_VARIABLE_NODE",
        message: `Variable "${variable.name}" references missing question node "${variable.questionNodeId}".`,
        path: `variables.${variableIndex}.questionNodeId`,
        nodeId: variable.questionNodeId,
        variableName: variable.name,
      });
    }
  });

  schema.edges.forEach((edge, edgeIndex) => {
    if (!nodeIds.has(edge.from)) {
      findings.push({
        level: "error",
        code: "INVALID_EDGE_TARGET",
        message: `Edge source "${edge.from}" does not exist.`,
        path: `edges.${edgeIndex}.from`,
        nodeId: edge.from,
      });
    }

    if (!nodeIds.has(edge.to)) {
      findings.push({
        level: "error",
        code: "INVALID_EDGE_TARGET",
        message: `Edge target "${edge.to}" does not exist.`,
        path: `edges.${edgeIndex}.to`,
        nodeId: edge.to,
      });
    }

    if (edge.condition && !variableNames.has(edge.condition.variableName)) {
      findings.push({
        level: "error",
        code: "INVALID_BRANCH_VARIABLE",
        message: `Edge condition references missing variable "${edge.condition.variableName}".`,
        path: `edges.${edgeIndex}.condition.variableName`,
        variableName: edge.condition.variableName,
      });
    }
  });

  const graph = new Map<string, Set<string>>();

  schema.nodes.forEach((node) => {
    if (node.nextNodeId && nodeIds.has(node.nextNodeId)) {
      addEdge(graph, node.id, node.nextNodeId);
    }

    node.branches?.forEach((branch) => {
      if (nodeIds.has(branch.goto)) {
        addEdge(graph, node.id, branch.goto);
      }
    });
  });

  const terminalNodeIds = new Set(
    schema.nodes
      .filter((node) => node.type === "terminal")
      .map((node) => node.id),
  );

  // Include explicit edges from `schema.edges` in the traversal graph,
  // except outgoing edges from terminal nodes. Visual edges after a
  // terminal screen do not represent executable traversal.
  schema.edges.forEach((edge) => {
    if (
      nodeIds.has(edge.from) &&
      nodeIds.has(edge.to) &&
      !terminalNodeIds.has(edge.from)
    ) {
      addEdge(graph, edge.from, edge.to);
    }
  });

  const reachableNodeIds = new Set<string>();
  const queue = nodeIds.has(schema.survey.entryNodeId) ? [schema.survey.entryNodeId] : [];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId || reachableNodeIds.has(nodeId)) {
      continue;
    }

    reachableNodeIds.add(nodeId);
    graph.get(nodeId)?.forEach((targetNodeId) => {
      if (!reachableNodeIds.has(targetNodeId)) {
        queue.push(targetNodeId);
      }
    });
  }

  schema.nodes.forEach((node, nodeIndex) => {
    if (!reachableNodeIds.has(node.id)) {
      findings.push({
        level: "warning",
        code: "UNREACHABLE_NODE",
        message: `Node "${node.id}" is not reachable from entry node "${schema.survey.entryNodeId}".`,
        path: `nodes.${nodeIndex}`,
        nodeId: node.id,
      });
    }
  });

  return findings;
};
