"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from "@xyflow/react";
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  RotateCcw,
  Split,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  defaultFlowNodePosition,
  getDefaultFlowNodePositions,
  getSavedFlowNodePosition,
  withDefaultFlowNodePositions,
  withFlowNodePositions,
} from "@/lib/schema/surveyFlowLayout";
import {
  QuestionTypeZ,
  SurveySchemaZ,
  type BranchRule,
  type Option,
  type QuestionNode,
  type SurveySchema,
} from "@/lib/schema/surveySchema";
import {
  addNodeAfter,
  insertNodeBefore,
  isBranchDecisionNode,
  nodeTypeUsesOptions,
  nodeTypeUsesVariable,
  renameNodeId,
  updateNode,
} from "@/lib/schema/surveyNodeEditing";
import {
  applyRouteTargets,
  deriveRouteTargets,
  removeBranchRule,
  updateBranchRule,
} from "@/lib/schema/surveyRouteEditing";
import {
  getNodeSeverity,
  groupFindingsByNode,
  type NodeSeverity,
} from "@/lib/validation/nodeFindingMap";
import type {
  ValidationFinding,
  ValidationReport,
} from "@/lib/validation/types";

type SurveyFlowEditorProps = {
  schemaText: string;
  validationReport: ValidationReport | null;
  onChange: (value: string) => void;
  onLayoutChange?: (schema: SurveySchema) => void | Promise<void>;
};

type FlowNodeData = Record<string, unknown> & {
  label: ReactNode;
  nodeType: QuestionNode["type"];
  isEntry: boolean;
};

const parseSchema = (
  schemaText: string,
): { ok: true; schema: SurveySchema } | { ok: false; error: string } => {
  try {
    const result = SurveySchemaZ.safeParse(JSON.parse(schemaText));

    if (!result.success) {
      return {
        ok: false,
        error:
          result.error.issues[0]?.message ??
          "Schema does not match the survey schema.",
      };
    }

    return { ok: true, schema: result.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
};

const stringifyBranchValue = (branch: BranchRule) => {
  if (!("value" in branch)) {
    return "";
  }

  return ` ${Array.isArray(branch.value) ? `[${branch.value.map(String).join(", ")}]` : String(branch.value)}`;
};

const branchLabel = (branch: BranchRule) =>
  `${branch.variableName} ${branch.operator}${stringifyBranchValue(branch)}`;

const answerPreviewForNode = (node: QuestionNode) => {
  switch (node.type) {
    case "single_choice":
    case "multiple_choice":
      return (
        node.options?.slice(0, 3).map((option) => option.label) ?? [
          "No answer options",
        ]
      );
    case "likert":
      if (node.scale?.min !== undefined && node.scale.max !== undefined) {
        return [`Likert scale ${node.scale.min}-${node.scale.max}`];
      }

      return (
        node.options?.slice(0, 3).map((option) => option.label) ?? [
          "Likert scale",
        ]
      );
    case "short_text":
      return ["Short text response"];
    case "long_text":
      return ["Long text response"];
    case "number":
      return ["Number response"];
    case "consent":
      return ["Consent copy"];
    case "terminal":
      return ["Completion screen"];
  }
};

const hiddenOptionCount = (node: QuestionNode) => {
  if (!nodeTypeUsesOptions(node.type)) {
    return 0;
  }

  return Math.max((node.options?.length ?? 0) - 3, 0);
};

const severityStyles = (severity: NodeSeverity) => {
  switch (severity) {
    case "error":
      return {
        bar: "bg-[var(--hs-error)]",
        badge:
          "border-[var(--hs-error)]/30 bg-[var(--hs-error)]/10 text-[var(--hs-error)]",
        border: "var(--hs-error)",
        label: "Error",
        panel:
          "border-[var(--hs-error)]/30 bg-[var(--hs-error)]/10 text-[var(--hs-error)]",
      };
    case "warning":
      return {
        bar: "bg-[var(--hs-warning)]",
        badge:
          "border-[var(--hs-warning)]/30 bg-[var(--hs-warning)]/10 text-[var(--hs-warning)]",
        border: "var(--hs-warning)",
        label: "Warning",
        panel:
          "border-[var(--hs-warning)]/30 bg-[var(--hs-warning)]/10 text-[var(--hs-warning)]",
      };
    case "suggestion":
      return {
        bar: "bg-[var(--hs-muted)]",
        badge:
          "border-[var(--hs-border)] bg-[var(--hs-surface-muted)] text-[var(--hs-muted)]",
        border: "var(--hs-border)",
        label: "Suggestion",
        panel:
          "border-[var(--hs-border)] bg-[var(--hs-surface-muted)] text-[var(--hs-muted)]",
      };
    case null:
      return {
        bar: "bg-transparent",
        badge: "border-[var(--hs-border)] bg-white text-[var(--hs-muted)]",
        border: "var(--hs-border)",
        label: "Ready",
        panel: "border-[var(--hs-border)] bg-white text-[var(--hs-muted)]",
      };
  }
};

const descriptionLabelForNode = (node: QuestionNode) => {
  if (node.type === "consent") {
    return "Consent body";
  }

  if (node.type === "terminal") {
    return "Completion message";
  }

  return "Description";
};

const parseOptionValue = (value: string) => {
  const trimmedValue = value.trim();

  if (trimmedValue === "true") {
    return true;
  }

  if (trimmedValue === "false") {
    return false;
  }

  if (trimmedValue === "null") {
    return null;
  }

  if (trimmedValue !== "" && !Number.isNaN(Number(trimmedValue))) {
    return Number(trimmedValue);
  }

  return value;
};

const optionValueText = (option: Option) =>
  option.value === null ? "null" : String(option.value);

const formatBranchEditorValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return value === undefined || value === null ? "" : String(value);
};

const parseBranchScalarValue = (value: string) => {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);

  return value;
};

const parseBranchEditorValue = (
  value: string,
  operator: BranchRule["operator"],
) => {
  if (operator === "in" || operator === "not_in") {
    return value
      .split(",")
      .map((item) => parseBranchScalarValue(item))
      .filter((item) => item !== "");
  }

  return parseBranchScalarValue(value);
};

const normalizeBranchOperator = (
  branch: BranchRule,
  operator: BranchRule["operator"],
): BranchRule => {
  if (operator === "exists" || operator === "missing") {
    return {
      variableName: branch.variableName,
      operator,
      goto: branch.goto,
    };
  }

  if (operator === "in" || operator === "not_in") {
    return {
      variableName: branch.variableName,
      operator,
      value: "value" in branch
        ? Array.isArray(branch.value)
          ? branch.value
          : [branch.value]
        : [],
      goto: branch.goto,
    };
  }

  return {
    variableName: branch.variableName,
    operator,
    value: "value" in branch && !Array.isArray(branch.value)
      ? branch.value
      : "",
    goto: branch.goto,
  };
};

const createOption = (options: Option[] | undefined): Option => {
  const index = (options?.length ?? 0) + 1;
  const id = `option_${index}`;

  return {
    id,
    label: `Option ${index}`,
    value: id,
  };
};

const buildFlowNodes = (
  schema: SurveySchema,
  findingsByNode: Map<string, ValidationFinding[]>,
  selectedNodeId: string | null,
): FlowNode<FlowNodeData>[] => {
  const defaultPositions = getDefaultFlowNodePositions(schema);

  return schema.nodes.map((node, index) => {
    const savedPosition = getSavedFlowNodePosition(schema, node.id);
    const isEntry = node.id === schema.survey.entryNodeId;
    const isSelected = node.id === selectedNodeId;
    const nodeFindings = findingsByNode.get(node.id) ?? [];
    const severity = getNodeSeverity(nodeFindings);
    const styles = severityStyles(severity);
    const previewItems = answerPreviewForNode(node);
    const extraOptions = hiddenOptionCount(node);
    const StatusIcon =
      severity === "error"
        ? AlertCircle
        : severity === "warning"
          ? TriangleAlert
          : CheckCircle2;

    return {
      id: node.id,
      type: "default",
      position:
        savedPosition ??
        defaultPositions.get(node.id) ??
        defaultFlowNodePosition(index),
      data: {
        nodeType: node.type,
        isEntry,
        label: (
          <div
            className={`relative w-[260px] overflow-hidden rounded-[10px] border text-left ${
              isSelected
                ? "border-2 border-[var(--hs-primary)] bg-[var(--hs-primary-soft)]/35 shadow-[0_18px_38px_-28px_rgba(37,99,77,0.65)]"
                : severity
                  ? "bg-white"
                  : isEntry
                    ? "border-[var(--hs-primary)] bg-white shadow-[0_16px_34px_-30px_rgba(38,54,47,0.45)]"
                    : "border-[var(--hs-border)] bg-white shadow-[0_16px_34px_-30px_rgba(38,54,47,0.45)]"
            }`}
            style={severity && !isSelected ? { borderColor: styles.border } : undefined}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${styles.bar}`} />
            <div className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="line-clamp-3 text-sm font-semibold leading-5 text-[var(--hs-text)]">
                  {node.title}
                </div>
                {isEntry ? (
                  <span className="shrink-0 rounded border border-[var(--hs-primary)]/20 bg-[var(--hs-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--hs-primary-deep)]">
                    Entry
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {node.variableName ? (
                  <span className="rounded border border-[var(--hs-primary)]/25 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--hs-text)]">
                    {node.variableName}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                {previewItems.map((item, itemIndex) => (
                  <div
                    key={`${node.id}-preview-${itemIndex}`}
                    className="truncate rounded-md border border-[var(--hs-border)] bg-[var(--hs-surface-muted)] px-2 py-1 text-xs text-[var(--hs-text)]"
                  >
                    {item}
                  </div>
                ))}
                {extraOptions ? (
                  <div className="text-xs font-medium text-[var(--hs-muted)]">
                    +{extraOptions} more
                  </div>
                ) : null}
              </div>
              {severity ? (
                <div
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase ${styles.badge}`}
                >
                  <StatusIcon className="size-3" />
                  {nodeFindings.length} {styles.label}
                </div>
              ) : null}
            </div>
          </div>
        ),
      },
      style: {
        background: "transparent",
        border: "none",
        padding: 0,
        width: 260,
      },
    };
  });
};

const buildFlowEdges = (schema: SurveySchema): FlowEdge[] => {
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (
    source: string,
    target: string,
    label: string,
    isBranch = false,
  ) => {
    const id = `${source}-${target}`;

    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    edges.push({
      id,
      source,
      target,
      label,
      animated: isBranch,
      style: { stroke: isBranch ? "var(--hs-warning)" : "var(--hs-primary)" },
      labelStyle: { fill: "var(--hs-muted)", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "var(--hs-surface)" },
    });
  };

  schema.nodes.forEach((node) => {
    if (node.nextNodeId) {
      addEdge(node.id, node.nextNodeId, "next");
    }

    node.branches?.forEach((branch) =>
      addEdge(node.id, branch.goto, branchLabel(branch), true),
    );
  });

  schema.edges.forEach((edge) => {
    addEdge(
      edge.from,
      edge.to,
      edge.condition ? branchLabel(edge.condition) : "edge",
      Boolean(edge.condition),
    );
  });

  return edges;
};

export function SurveyFlowEditor({
  schemaText,
  validationReport,
  onChange,
  onLayoutChange,
}: SurveyFlowEditorProps) {
  const parsed = useMemo(() => parseSchema(schemaText), [schemaText]);
  const findingsByNode = useMemo(
    () =>
      parsed.ok
        ? groupFindingsByNode(parsed.schema, validationReport?.findings ?? [])
        : new Map<string, ValidationFinding[]>(),
    [parsed, validationReport],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const initialNodes = useMemo(
    () =>
      parsed.ok
        ? buildFlowNodes(parsed.schema, findingsByNode, selectedNodeId)
        : [],
    [parsed, findingsByNode, selectedNodeId],
  );
  const initialEdges = useMemo(
    () => (parsed.ok ? buildFlowEdges(parsed.schema) : []),
    [parsed],
  );
  const [nodes, setNodes, onNodesChange] =
    useNodesState<FlowNode<FlowNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<FlowEdge>(initialEdges);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodeIdError, setNodeIdError] = useState<string | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(360);
  const [isResizingSplit, setIsResizingSplit] = useState(false);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  useEffect(() => {
    if (!isFullscreen || !isResizingSplit) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const viewportWidth = window.innerWidth;
      const nextWidth = viewportWidth - event.clientX - 32;
      const maxWidth = Math.min(560, Math.max(320, viewportWidth - 620));

      setInspectorWidth(Math.min(Math.max(nextWidth, 320), maxWidth));
    };

    const handlePointerUp = () => setIsResizingSplit(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isFullscreen, isResizingSplit]);

  if (!parsed.ok) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed border-[var(--hs-border)] bg-[var(--hs-surface)] p-8 text-center">
        <div className="max-w-md">
          <AlertCircle className="mx-auto size-8 text-[var(--hs-warning)]" />
          <h2 className="mt-3 text-lg font-semibold text-[var(--hs-text)]">
            Flow unavailable
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">
            {parsed.error}
          </p>
        </div>
      </div>
    );
  }

  const selectedNode =
    parsed.schema.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNodeFindings = selectedNode
    ? (findingsByNode.get(selectedNode.id) ?? [])
    : [];
  const selectedNodeSeverity = getNodeSeverity(selectedNodeFindings);
  const selectedSeverityStyles = severityStyles(selectedNodeSeverity);

  const updateSelectedNode = (patch: Partial<QuestionNode>) => {
    if (!selectedNode) {
      return;
    }

    const nextSchema = updateNode(parsed.schema, selectedNode.id, patch);

    onChange(JSON.stringify(nextSchema, null, 2));
  };

  const writeSchema = (schema: SurveySchema) => {
    onChange(JSON.stringify(schema, null, 2));
  };

  const selectedRouteTargets = selectedNode
    ? deriveRouteTargets(selectedNode)
    : { selectedTargetIds: [], defaultTargetId: undefined };
  const displayedDefaultTargetId =
    selectedRouteTargets.defaultTargetId ??
    (selectedRouteTargets.selectedTargetIds.length === 1
      ? selectedRouteTargets.selectedTargetIds[0]
      : undefined);
  const availableRouteTargets = parsed.schema.nodes.filter(
    (node) => node.id !== selectedNode?.id,
  );

  const updateRouteTargets = (targetId: string, checked: boolean) => {
    if (!selectedNode) {
      return;
    }

    const selectedTargetIds = checked
      ? [...selectedRouteTargets.selectedTargetIds, targetId]
      : selectedRouteTargets.selectedTargetIds.filter(
          (selectedTargetId) => selectedTargetId !== targetId,
        );

    writeSchema(
      applyRouteTargets(parsed.schema, selectedNode.id, {
        selectedTargetIds,
        defaultTargetId: displayedDefaultTargetId,
        addedTargetId: checked ? targetId : undefined,
        removedTargetId: checked ? undefined : targetId,
      }),
    );
  };

  const updateDefaultRouteTarget = (defaultTargetId: string) => {
    if (!selectedNode) {
      return;
    }

    writeSchema(
      applyRouteTargets(parsed.schema, selectedNode.id, {
        selectedTargetIds: selectedRouteTargets.selectedTargetIds,
        defaultTargetId,
      }),
    );
  };

  const updateSelectedBranch = (index: number, branch: BranchRule) => {
    if (!selectedNode) {
      return;
    }

    writeSchema(updateBranchRule(parsed.schema, selectedNode.id, index, branch));
  };

  const saveFlowLayout = (draggedNode: FlowNode<FlowNodeData>) => {
    const nextNodes = nodes.map((node) =>
      node.id === draggedNode.id ? draggedNode : node,
    );
    const nextSchema = withFlowNodePositions(
      parsed.schema,
      nextNodes.map((node) => ({ id: node.id, position: node.position })),
    );

    writeSchema(nextSchema);
    void onLayoutChange?.(nextSchema);
  };

  const resetFlowLayout = () => {
    const nextSchema = withDefaultFlowNodePositions(parsed.schema);

    writeSchema(nextSchema);
    setNodes(buildFlowNodes(nextSchema, findingsByNode, selectedNodeId));
    void onLayoutChange?.(nextSchema);
  };

  const commitNodeId = (nextNodeId: string) => {
    if (!selectedNode) {
      return;
    }

    try {
      const nextSchema = renameNodeId(
        parsed.schema,
        selectedNode.id,
        nextNodeId,
      );
      const nextId = nextNodeId.trim();

      setNodeIdError(null);
      setSelectedNodeId(nextId);
      writeSchema(nextSchema);
    } catch (error) {
      setNodeIdError(
        error instanceof Error ? error.message : "Unable to rename node",
      );
    }
  };

  const handleNodeIdKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitNodeId(event.currentTarget.value);
    }
  };

  const updateOption = (index: number, patch: Partial<Option>) => {
    if (!selectedNode) {
      return;
    }

    const options = [...(selectedNode.options ?? [])];
    options[index] = { ...options[index], ...patch };
    updateSelectedNode({ options });
  };

  const addOption = () => {
    if (!selectedNode) {
      return;
    }

    updateSelectedNode({
      options: [
        ...(selectedNode.options ?? []),
        createOption(selectedNode.options),
      ],
    });
  };

  const removeOption = (index: number) => {
    if (!selectedNode) {
      return;
    }

    updateSelectedNode({
      options:
        selectedNode.options?.filter(
          (_, optionIndex) => optionIndex !== index,
        ) ?? [],
    });
  };

  const insertBeforeSelectedNode = () => {
    if (!selectedNode) {
      return;
    }

    const nextSchema = insertNodeBefore(parsed.schema, selectedNode.id);
    const insertedIndex = nextSchema.nodes.findIndex(
      (node) => node.nextNodeId === selectedNode.id,
    );
    const insertedNode =
      insertedIndex >= 0 ? nextSchema.nodes[insertedIndex] : null;

    if (insertedNode) {
      setSelectedNodeId(insertedNode.id);
    }

    writeSchema(nextSchema);
  };

  const addAfterSelectedNode = () => {
    if (!selectedNode) {
      return;
    }

    const nextSchema = addNodeAfter(parsed.schema, selectedNode.id);
    const addedNode = nextSchema.nodes.find(
      (node) =>
        selectedNode.nextNodeId !== node.id &&
        node.nextNodeId === selectedNode.nextNodeId &&
        node.id !== selectedNode.id,
    );

    setSelectedNodeId(
      addedNode?.id ??
        nextSchema.nodes[
          nextSchema.nodes.findIndex((node) => node.id === selectedNode.id) + 1
        ]?.id ??
        selectedNode.id,
    );
    writeSchema(nextSchema);
  };

  const editor = (
    <div
      style={
        {
          "--flow-inspector-width": `${inspectorWidth}px`,
        } as CSSProperties
      }
      className={
        isFullscreen
          ? "grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(520px,1fr)_10px_var(--flow-inspector-width)]"
          : "grid min-h-[620px] gap-4 xl:grid-cols-[minmax(520px,1fr)_360px]"
      }
    >
      <div className="overflow-hidden rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--hs-border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--hs-text)]">
              Schema flow
            </h2>
            <p className="mt-1 text-xs text-[var(--hs-muted)]">
              Drag to inspect. Select a node to edit its core fields.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--hs-muted)]">
              <GitBranch className="size-4" />
              {edges.length} edges
            </div>
            <Button variant="secondary" size="sm" onClick={resetFlowLayout}>
              <RotateCcw />
              Reset layout
            </Button>
            {!isFullscreen ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFullscreen(true)}
              >
                <Maximize2 />
                Fullscreen
              </Button>
            ) : null}
          </div>
        </div>
        <div
          className={
            isFullscreen ? "h-[calc(100dvh-148px)] min-h-[520px]" : "h-[560px]"
          }
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              setNodeIdError(null);
              setSelectedNodeId(node.id);
            }}
            onPaneClick={() => {
              setNodeIdError(null);
              setSelectedNodeId(null);
            }}
            onNodeDragStop={(_, node) => saveFlowLayout(node)}
            fitView
            isValidConnection={(connection) =>
              connection.source !== connection.target
            }
          >
            <Background gap={18} color="#d9e0da" />
            <Controls />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) =>
                node.data.isEntry
                  ? "var(--hs-primary)"
                  : "var(--hs-surface-muted)"
              }
            />
          </ReactFlow>
        </div>
      </div>

      {isFullscreen ? (
        <button
          aria-label="Resize flow editor panels"
          className="hidden min-h-[calc(100dvh-96px)] cursor-col-resize rounded-full border border-transparent bg-transparent transition hover:border-[var(--hs-border)] hover:bg-[var(--hs-surface-muted)] xl:block"
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizingSplit(true);
          }}
        >
          <span className="mx-auto block h-full w-px bg-[var(--hs-border)]" />
        </button>
      ) : null}

      <aside
        className={
          isFullscreen
            ? "max-h-[calc(100dvh-96px)] overflow-y-auto rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] p-4"
            : "max-h-[620px] overflow-y-auto rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] p-4"
        }
      >
        {selectedNode ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--hs-muted)]">
                  {selectedNode.type}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--hs-text)]">
                  {selectedNode.id}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={insertBeforeSelectedNode}
                  disabled={
                    selectedNode.id === parsed.schema.survey.entryNodeId
                  }
                >
                  <Split />
                  Insert before
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addAfterSelectedNode}
                  disabled={selectedNode.type === "terminal"}
                >
                  <Plus />
                  Add after
                </Button>
              </div>
            </div>

            {selectedNodeFindings.length ? (
              <div
                aria-live={
                  selectedNodeSeverity === "error" ? undefined : "polite"
                }
                className={`rounded-lg border p-3 ${selectedSeverityStyles.panel}`}
                role={selectedNodeSeverity === "error" ? "alert" : undefined}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {selectedNodeSeverity === "error" ? (
                    <AlertCircle className="size-4" />
                  ) : (
                    <TriangleAlert className="size-4" />
                  )}
                  {selectedNodeFindings.length} {selectedSeverityStyles.label}
                  {selectedNodeFindings.length === 1 ? "" : "s"}
                </div>
                <ul className="mt-2 space-y-2">
                  {selectedNodeFindings.slice(0, 3).map((finding, index) => (
                    <li
                      key={`${finding.code}-${finding.path}-${index}`}
                      className="rounded-md bg-white/70 p-2 text-xs leading-5 text-[var(--hs-text)]"
                    >
                      <div className="font-semibold">{finding.code}</div>
                      <div>{finding.message}</div>
                      <div className="mt-1 font-mono text-[10px] text-[var(--hs-muted)]">
                        {finding.path}
                      </div>
                    </li>
                  ))}
                </ul>
                {selectedNodeFindings.length > 3 ? (
                  <p className="mt-2 text-xs font-medium">
                    +{selectedNodeFindings.length - 3} more findings
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--hs-text)]">
                Node ID
              </span>
              <input
                key={selectedNode.id}
                className="h-10 w-full rounded-lg border border-[var(--hs-border)] bg-white px-3 font-mono text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                defaultValue={selectedNode.id}
                onBlur={(event) => commitNodeId(event.currentTarget.value)}
                onKeyDown={handleNodeIdKeyDown}
              />
              <span className="block text-xs leading-5 text-[var(--hs-muted)]">
                Used by flow references and variable metadata.
              </span>
              {nodeIdError ? (
                <span className="block text-xs text-[var(--hs-error)]">
                  {nodeIdError}
                </span>
              ) : null}
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--hs-text)]">
                Question type
              </span>
              <select
                className="h-10 w-full rounded-lg border border-[var(--hs-border)] bg-white px-3 text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                value={selectedNode.type}
                onChange={(event) =>
                  updateSelectedNode({
                    type: event.target.value as QuestionNode["type"],
                  })
                }
              >
                {QuestionTypeZ.options.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--hs-text)]">
                Question
              </span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--hs-border)] bg-white px-3 text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                value={selectedNode.title}
                onChange={(event) =>
                  updateSelectedNode({ title: event.target.value })
                }
              />
            </label>

            {nodeTypeUsesVariable(selectedNode.type) ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--hs-text)]">
                  Variable name
                </span>
                <input
                  className="h-10 w-full rounded-lg border border-[var(--hs-border)] bg-white px-3 font-mono text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                  value={selectedNode.variableName ?? ""}
                  onChange={(event) =>
                    updateSelectedNode({
                      variableName: event.target.value.trim() || undefined,
                    })
                  }
                />
                <span className="block text-xs leading-5 text-[var(--hs-muted)]">
                  Used in submitted answers and exports.
                </span>
              </label>
            ) : null}

            {nodeTypeUsesOptions(selectedNode.type) ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--hs-text)]">
                    Answer Options
                  </span>
                  <Button variant="secondary" size="xs" onClick={addOption}>
                    <Plus />
                    Add option
                  </Button>
                </div>
                <div className="space-y-2">
                  {(selectedNode.options ?? []).map((option, index) => (
                    <div
                      key={`${option.id}-${index}`}
                      className="rounded-lg border border-[var(--hs-border)] bg-white p-2"
                    >
                      <div className="grid gap-2">
                        <label className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
                          <span className="text-xs font-medium text-[var(--hs-muted)]">
                            Label
                          </span>
                          <input
                            className="h-9 w-full rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                            value={option.label}
                            onChange={(event) =>
                              updateOption(index, { label: event.target.value })
                            }
                          />
                        </label>
                        <div className="grid grid-cols-[52px_128px_auto] items-center gap-2">
                          <label className="contents">
                            <span className="text-xs font-medium text-[var(--hs-muted)]">
                              Value
                            </span>
                            <input
                              className="h-9 w-32 rounded-md border border-[var(--hs-border)] px-2 font-mono text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                              value={optionValueText(option)}
                              onChange={(event) =>
                                updateOption(index, {
                                  value: parseOptionValue(event.target.value),
                                })
                              }
                            />
                          </label>
                          <Button
                            className="justify-self-start"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--hs-text)]">
                {descriptionLabelForNode(selectedNode)}
              </span>
              <textarea
                className="h-28 w-full resize-y rounded-lg border border-[var(--hs-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                value={selectedNode.body ?? ""}
                onChange={(event) =>
                  updateSelectedNode({
                    body: event.target.value.trim()
                      ? event.target.value
                      : undefined,
                  })
                }
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--hs-text)]">
                  Next nodes
                </span>
                {displayedDefaultTargetId ? (
                  <span className="truncate text-xs text-[var(--hs-muted)]">
                    Default: {displayedDefaultTargetId}
                  </span>
                ) : null}
              </div>
              <div className="max-h-44 overflow-auto rounded-lg border border-[var(--hs-border)] bg-white p-2">
                {availableRouteTargets.map((node) => {
                  const checked = selectedRouteTargets.selectedTargetIds.includes(
                    node.id,
                  );
                  const isDefault = checked && displayedDefaultTargetId === node.id;

                  return (
                    <label
                      key={node.id}
                      className="flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-[var(--hs-text)] hover:bg-[var(--hs-surface-muted)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          className="size-4 shrink-0 rounded border-[var(--hs-border)] accent-[var(--hs-primary)]"
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            updateRouteTargets(node.id, event.target.checked)
                          }
                        />
                        <span className="truncate font-mono">{node.id}</span>
                      </span>
                      {isDefault ? (
                        <span className="shrink-0 rounded border border-[var(--hs-primary)]/20 bg-[var(--hs-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--hs-primary-deep)]">
                          Default
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-[var(--hs-text)]">
              <input
                className="size-4 rounded border-[var(--hs-border)] accent-[var(--hs-primary)]"
                type="checkbox"
                checked={
                  isBranchDecisionNode(selectedNode) ||
                  Boolean(selectedNode.required)
                }
                disabled={isBranchDecisionNode(selectedNode)}
                onChange={(event) =>
                  updateSelectedNode({ required: event.target.checked })
                }
              />
              Required
            </label>
            {isBranchDecisionNode(selectedNode) ? (
              <p className="-mt-3 text-xs text-[var(--hs-muted)]">
                Required is locked because this node decides a branch.
              </p>
            ) : null}

            <div className="rounded-lg border border-[var(--hs-border)] bg-[var(--hs-surface-muted)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-[var(--hs-muted)]">
                  Branch rules
                </p>
                <span className="text-xs text-[var(--hs-muted)]">
                  {selectedRouteTargets.selectedTargetIds.length > 1
                    ? `${selectedRouteTargets.selectedTargetIds.length - 1} conditional`
                    : "No conditions needed"}
                </span>
              </div>

              <div className="mt-3 space-y-3 text-xs text-[var(--hs-text)]">
                {selectedRouteTargets.selectedTargetIds.length === 0 ? (
                  <div className="text-xs text-[var(--hs-muted)]">
                    No next nodes selected
                  </div>
                ) : selectedRouteTargets.selectedTargetIds.length === 1 ? (
                  <div className="rounded-md border border-[var(--hs-border)] bg-white px-3 py-2">
                    <span className="text-[var(--hs-muted)]">
                      Default route:{" "}
                    </span>
                    <span className="font-mono">{displayedDefaultTargetId}</span>
                  </div>
                ) : (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[var(--hs-muted)]">
                        Default route
                      </span>
                      <select
                        className="h-9 w-full rounded-md border border-[var(--hs-border)] bg-white px-2 text-sm outline-none focus:border-[var(--hs-primary)] focus:ring-3 focus:ring-[var(--hs-primary)]/15"
                        value={displayedDefaultTargetId ?? ""}
                        onChange={(event) =>
                          updateDefaultRouteTarget(event.target.value)
                        }
                      >
                        {selectedRouteTargets.selectedTargetIds.map((targetId) => (
                          <option key={targetId} value={targetId}>
                            {targetId}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedRouteTargets.selectedTargetIds.length > 1 &&
                    (selectedNode.branches ?? []).length === 0 ? (
                      <div className="rounded-md border border-[var(--hs-warning)]/30 bg-[var(--hs-warning)]/10 px-3 py-2 text-xs text-[var(--hs-text)]">
                        Add a variable before configuring conditional routes.
                      </div>
                    ) : null}

                    {(selectedNode.branches ?? []).map((branch, index) => {
                      const variableOptions = parsed.schema.variables.map(
                        (v) => v.name,
                      );
                      const targetNodeOptions =
                        selectedRouteTargets.selectedTargetIds.filter(
                          (targetId) => targetId !== displayedDefaultTargetId,
                        );

                      return (
                        <div
                          key={`${branch.goto}-${index}`}
                          className="grid grid-cols-[minmax(0,1fr)_110px_90px] gap-2 rounded-md border border-[var(--hs-border)] bg-white p-2"
                        >
                          <select
                            className="h-9 min-w-0 rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none"
                            value={branch.variableName}
                            onChange={(event) =>
                              updateSelectedBranch(index, {
                                ...branch,
                                variableName: event.target.value,
                              })
                            }
                          >
                            {variableOptions.map((variableName) => (
                              <option key={variableName} value={variableName}>
                                {variableName}
                              </option>
                            ))}
                          </select>

                          <select
                            className="h-9 rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none"
                            value={branch.operator}
                            onChange={(event) =>
                              updateSelectedBranch(
                                index,
                                normalizeBranchOperator(
                                  branch,
                                  event.target.value as BranchRule["operator"],
                                ),
                              )
                            }
                          >
                            <option value="equals">equals</option>
                            <option value="not_equals">not equals</option>
                            <option value="in">in</option>
                            <option value="not_in">not in</option>
                            <option value="exists">exists</option>
                            <option value="missing">missing</option>
                          </select>

                          {branch.operator === "exists" ||
                          branch.operator === "missing" ? (
                            <div className="flex h-9 items-center rounded-md border border-transparent px-2 text-sm text-[var(--hs-muted)]">
                              no value
                            </div>
                          ) : (
                            <input
                              className="h-9 min-w-0 rounded-md border border-[var(--hs-border)] px-2 font-mono text-sm outline-none"
                              value={
                                "value" in branch
                                  ? formatBranchEditorValue(branch.value)
                                  : ""
                              }
                              onChange={(event) =>
                                updateSelectedBranch(index, {
                                  ...branch,
                                  value: parseBranchEditorValue(
                                    event.target.value,
                                    branch.operator,
                                  ),
                                } as BranchRule)
                              }
                            />
                          )}

                          <div className="col-span-3 flex items-center gap-2">
                            <span className="text-xs text-[var(--hs-muted)]">
                              Go to
                            </span>
                            <select
                              className="h-9 min-w-0 flex-1 rounded-md border border-[var(--hs-border)] px-2 text-sm outline-none"
                              value={branch.goto}
                              onChange={(event) =>
                                updateSelectedBranch(index, {
                                  ...branch,
                                  goto: event.target.value,
                                })
                              }
                            >
                              {targetNodeOptions.map((targetId) => (
                                <option key={targetId} value={targetId}>
                                  {targetId}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                writeSchema(
                                  removeBranchRule(
                                    parsed.schema,
                                    selectedNode.id,
                                    index,
                                  ),
                                );
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedNodeId(null)}
            >
              Clear selection
            </Button>
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center text-center">
            <div>
              <MousePointer2 className="mx-auto size-8 text-[var(--hs-muted)]" />
              <h3 className="mt-3 text-sm font-semibold text-[var(--hs-text)]">
                Select a node
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">
                Node title, body, required state, and default next node can be
                edited here.
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--hs-page)] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--hs-border)] bg-[var(--hs-surface)] px-4 py-3 shadow-[0_18px_44px_-34px_rgba(38,54,47,0.35)]">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--hs-muted)]">
              Immersive flow editor
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--hs-text)]">
              {parsed.schema.survey.title}
            </h2>
          </div>
          <Button variant="secondary" onClick={() => setIsFullscreen(false)}>
            <Minimize2 />
            Exit fullscreen
          </Button>
        </div>
        {editor}
      </div>
    );
  }

  return editor;
}
