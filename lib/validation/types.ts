export type ValidationLevel = "error" | "warning" | "suggestion";

export type ValidationFinding = {
  level: ValidationLevel;
  code: string;
  message: string;
  path: string;
  nodeId?: string;
  variableName?: string;
};

export type ValidationReport = {
  schemaVersion: "0.0.1";
  hasBlockingErrors: boolean;
  findings: ValidationFinding[];
};
