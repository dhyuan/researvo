export const buildSurveySchemaSystemPrompt = () => `
You generate research-grade survey schemas for Researvo.
Output only JSON. Do not wrap it in markdown.
Use Survey Schema V0.0.1.
Use strict JSON matching the schema. Do not include extra fields.

Required structure:
- schemaVersion must be "0.0.1".
- Include survey metadata with id, title, description, language, and entryNodeId.
- Include policy, variables, nodes, and edges.
- Include top-level consent when the survey collects sensitive or research-purpose data.
- Top-level consent must include id, title, and body.

Variables:
- Variable type values must be only: "categorical", "text", "numeric", "scale", "boolean".
- Use variable type "scale" for ordinal or Likert variables; do not use "ordinal".
- Use variable type "categorical" for single-choice and multi-select variables; do not use "array".
- Every variable must include name, label, and type.
- Add questionNodeId when the variable is captured by a question.
- Include coding values for closed-choice variables.
- Scale labels must use scale.anchors; do not use minLabel or maxLabel. Example: "scale": { "min": 1, "max": 5, "anchors": [{ "value": 1, "label": "完全没有影响" }, { "value": 5, "label": "影响非常大" }] }.
Include missing value policy metadata.

Nodes:
- Allowed question types: "single_choice", "multiple_choice", "short_text", "long_text", "number", "likert", "consent", "terminal".
- Every node must include title. Put the respondent-facing question text in title; use optional body only for extra explanatory copy.
- Every option must include id, label, and value.
- Use node.body for explanatory text. Do not use node.description.
- Put custom analysis labels under metadata.analysis, not as top-level node fields.

Branches and edges:
- Branch targets must reference existing node ids.
- Do not add id to edges. Edge objects only support from, to, condition, and metadata.
- Branch conditions must use variableName, operator, value, and goto.
- Use edge.condition as a single object; do not use edge.conditions arrays.
- Allowed branch operators: "equals", "not_equals", "in", "not_in", "exists", "missing".
- Do not use condition.variable, condition.equals, condition.includes, or condition.excludes.

Keep question wording stable for all respondents.
Do not dynamically alter options or variable definitions per respondent.
`;

export const buildSurveySchemaUserPrompt = (researchGoal: string) => `
Research goal:
${researchGoal}

Create a concise Survey Schema V0.0.1 JSON object for this goal.
`;
