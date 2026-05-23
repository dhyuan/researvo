import type { SurveySchema } from "./surveySchema";

export const exampleSurveySchema: SurveySchema = {
  schemaVersion: "0.0.1",
  survey: {
    id: "student-research-example",
    title: "Student Research Example",
    description: "A minimal research-grade survey example.",
    language: "en",
    entryNodeId: "consent",
  },
  policy: {
    accessMode: "anonymous",
    duplicatePrevention: "none",
    captcha: "off",
    piiHandling: "none",
  },
  consent: {
    id: "consent",
    title: "Consent",
    body: "Participation is voluntary. Responses are collected for a student research project.",
    required: true,
  },
  variables: [
    {
      name: "gender",
      label: "Gender",
      type: "categorical",
      questionNodeId: "q_gender",
      required: true,
      coding: [
        { label: "Male", value: 1 },
        { label: "Female", value: 2 },
        { label: "Other", value: 3 },
        { label: "Prefer not to say", value: 99, missing: "refused" },
      ],
      missingValues: [{ reason: "not_shown", value: null }],
    },
  ],
  nodes: [
    { id: "consent", type: "consent", title: "Consent", variableName: null, nextNodeId: "q_gender" },
    {
      id: "q_gender",
      type: "single_choice",
      title: "What is your gender?",
      variableName: "gender",
      required: true,
      options: [
        { id: "male", label: "Male", value: 1 },
        { id: "female", label: "Female", value: 2 },
        { id: "other", label: "Other", value: 3 },
        { id: "refused", label: "Prefer not to say", value: 99, missing: "refused" },
      ],
      nextNodeId: "end",
    },
    { id: "end", type: "terminal", title: "Complete", variableName: null },
  ],
  edges: [
    { from: "consent", to: "q_gender" },
    { from: "q_gender", to: "end" },
  ],
  metadata: { template: "economics_student_basic" },
};
