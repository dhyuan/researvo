import type { z } from "zod";

const ALLOWED_VARIABLE_TYPES = ['"categorical"', '"text"', '"numeric"', '"scale"', '"boolean"'].join(", ");
const ALLOWED_BRANCH_OPERATORS = ['"equals"', '"not_equals"', '"in"', '"not_in"', '"exists"', '"missing"'].join(", ");

function formatPath(path: PropertyKey[]) {
  if (path.length === 0) {
    return "schema";
  }

  return path
    .map((part, index) => {
      if (typeof part === "number") {
        return `[${part}]`;
      }

      return index === 0 ? String(part) : `.${String(part)}`;
    })
    .join("");
}

function suggestionFor(path: string, message: string) {
  if (path === "consent.id" || path === "consent.title" || path === "consent.body") {
    return 'Top-level consent must include id, title, and body. Example: { "id": "consent_001", "title": "知情同意", "body": "..." }.';
  }

  if (path.match(/^nodes\[\d+\]\.title$/)) {
    return 'Every node must include title. Put the respondent-facing question text in "title"; use optional "body" only for extra explanatory copy.';
  }

  if (path.match(/^variables\[\d+\]\.label$/)) {
    return "Add a human-readable label, for example: \"label\": \"Gender identity\".";
  }

  if (path.match(/^variables\[\d+\]\.type$/)) {
    return `Variable type values must be only: ${ALLOWED_VARIABLE_TYPES}. Use "scale" for ordinal/Likert values, and use "categorical" with coding for multi-select variables; array is not supported.`;
  }

  if (path.match(/^nodes\[\d+\]\.options\[\d+\]\.id$/)) {
    return "Every option must include id, label, and value. Example: { \"id\": \"female\", \"label\": \"女性\", \"value\": \"female\" }.";
  }

  if (path.match(/^edges\[\d+\]\.condition\.operator$/) || path.match(/^nodes\[\d+\]\.branches\[\d+\]\.operator$/)) {
    return `Branch conditions must use variableName, operator, value, and goto. Allowed operators: ${ALLOWED_BRANCH_OPERATORS}. Example: { "variableName": "consent_participate", "operator": "equals", "value": true, "goto": "q_gender_identity" }.`;
  }

  if (path.match(/^edges\[\d+\]\.condition$/)) {
    return `Use condition: { "variableName": "...", "operator": "equals", "value": ..., "goto": "target_node_id" }. Do not use condition.variable, condition.equals, condition.includes, or condition.excludes.`;
  }

  if (message.includes("Unrecognized key")) {
    if (path.match(/^edges\[\d+\]$/)) {
      if (message.includes("id")) {
        return 'Do not include edge id. Edge objects only support from, to, condition, and metadata. Example: { "from": "q001", "to": "q002" }.';
      }

      return 'Use "condition" as a single object, not "conditions" as an array. Example: { "from": "consent_001", "to": "q001", "condition": { "variableName": "consent_given", "operator": "equals", "value": true, "goto": "q001" } }.';
    }

    if (path.match(/^nodes\[\d+\]\.scale$/) || path.match(/^variables\[\d+\]\.scale$/)) {
      return 'Use scale.anchors for endpoint labels. Do not use minLabel or maxLabel. Example: "scale": { "min": 1, "max": 5, "anchors": [{ "value": 1, "label": "完全没有影响" }, { "value": 5, "label": "影响非常大" }] }.';
    }

    if (path.match(/^nodes\[\d+\]$/)) {
      return 'Question nodes only support id, type, title, body, variableName, required, options, nextNodeId, branches, scale, pii, and metadata. Use "body" instead of "description"; put custom fields like "analysis" under metadata.';
    }

    return "Remove this extra field or move custom data under metadata.";
  }

  return "Check this field against the Researvo schema requirements.";
}

function issueSummary(issue: z.core.$ZodIssue) {
  const path = formatPath(issue.path);

  if (issue.code === "unrecognized_keys") {
    const keys = "keys" in issue ? issue.keys.join(", ") : "unknown";
    return `${path}: Unexpected field(s): ${keys}. ${suggestionFor(path, `Unrecognized key(s): ${keys}`)}`;
  }

  return `${path}: ${issue.message}. ${suggestionFor(path, issue.message)}`;
}

function issueGroupKey(issue: z.core.$ZodIssue) {
  const path = formatPath(issue.path);

  if (path === "consent.id" || path === "consent.title" || path === "consent.body") {
    return "consent-required-fields";
  }

  if (path.match(/^nodes\[\d+\]\.title$/)) {
    return "node-required-title";
  }

  if (path.match(/^variables\[\d+\]\.label$/)) {
    return "variable-required-label";
  }

  if (path.match(/^variables\[\d+\]\.type$/)) {
    return "variable-type";
  }

  if (path.match(/^nodes\[\d+\]\.options\[\d+\]\.id$/)) {
    return "option-required-id";
  }

  if (path.match(/^edges\[\d+\]$/)) {
    return "edge-shape";
  }

  if (path.match(/^edges\[\d+\]\.condition/)) {
    return "edge-condition";
  }

  if (issue.code === "unrecognized_keys") {
    return `unrecognized-${path}`;
  }

  return `${path}-${issue.code}`;
}

export function formatSurveySchemaError(error: z.ZodError) {
  const seenGroups = new Set<string>();
  const representativeIssues = error.issues.filter((issue) => {
    const key = issueGroupKey(issue);

    if (seenGroups.has(key)) {
      return false;
    }

    seenGroups.add(key);
    return true;
  });
  const summaries = representativeIssues.slice(0, 8).map(issueSummary);
  const hiddenCount = Math.max(error.issues.length - summaries.length, 0);

  return [
    "JSON parsed, but it does not match the Researvo schema.",
    "",
    ...summaries.map((summary) => `- ${summary}`),
    ...(hiddenCount > 0 ? [`- ${hiddenCount} more issue(s) not shown. Fix the items above, then validate again.`] : []),
  ].join("\n");
}
