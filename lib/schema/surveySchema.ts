import { z } from "zod";

export const QuestionTypeZ = z.enum([
  "single_choice",
  "multiple_choice",
  "short_text",
  "long_text",
  "number",
  "likert",
  "consent",
  "terminal",
]);

export const AccessModeZ = z.enum([
  "anonymous",
  "oauth",
  "invite_only",
  "organization",
  "proof_of_personhood",
]);

export const MissingValueReasonZ = z.enum([
  "not_shown",
  "skipped",
  "refused",
  "unknown",
  "timeout",
  "system_error",
]);

const ScalarValueZ = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const MetadataZ = z.record(z.string(), z.unknown());

export const SurveyMetadataZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  language: z.string().min(1),
  entryNodeId: z.string().min(1),
  metadata: MetadataZ.optional(),
}).strict();

export const SurveyPolicyZ = z.object({
  accessMode: AccessModeZ,
  duplicatePrevention: z.enum(["none", "cookie", "account", "invite", "device"]).optional(),
  captcha: z.enum(["off", "optional", "required"]).optional(),
  piiHandling: z.enum(["none", "minimized", "restricted", "encrypted"]).optional(),
  metadata: MetadataZ.optional(),
}).strict();

export const ConsentBlockZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  required: z.boolean().default(true),
  version: z.string().optional(),
  metadata: MetadataZ.optional(),
}).strict();

const PiiClassificationZ = z.object({
  level: z.enum(["none", "low", "moderate", "high", "sensitive"]),
  category: z.string().optional(),
  notes: z.string().optional(),
}).strict();

const CodingValueZ = z.object({
  label: z.string().min(1),
  value: ScalarValueZ,
  missing: MissingValueReasonZ.optional(),
  metadata: MetadataZ.optional(),
}).strict();

const MissingValueZ = z.object({
  reason: MissingValueReasonZ,
  value: ScalarValueZ,
  label: z.string().optional(),
}).strict();

const ScaleMetadataZ = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  anchors: z
    .array(
      z.object({
        value: z.number(),
        label: z.string().min(1),
      }).strict(),
    )
    .optional(),
}).strict();

export const VariableDefinitionZ = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["categorical", "text", "numeric", "scale", "boolean"]),
  questionNodeId: z.string().min(1).optional(),
  required: z.boolean().optional(),
  coding: z.array(CodingValueZ).optional(),
  missingValues: z.array(MissingValueZ).optional(),
  scale: ScaleMetadataZ.optional(),
  pii: PiiClassificationZ.optional(),
  metadata: MetadataZ.optional(),
}).strict();

export const OptionZ = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: ScalarValueZ,
  missing: MissingValueReasonZ.optional(),
  metadata: MetadataZ.optional(),
}).strict();

const BranchRuleBaseShape = {
  variableName: z.string().min(1),
  goto: z.string().min(1),
  metadata: MetadataZ.optional(),
};

export const BranchRuleZ = z.discriminatedUnion("operator", [
  z.object({
    ...BranchRuleBaseShape,
    operator: z.literal("equals"),
    value: ScalarValueZ,
  }).strict(),
  z.object({
    ...BranchRuleBaseShape,
    operator: z.literal("not_equals"),
    value: ScalarValueZ,
  }).strict(),
  z.object({
    ...BranchRuleBaseShape,
    operator: z.literal("in"),
    value: z.array(ScalarValueZ),
  }).strict(),
  z.object({
    ...BranchRuleBaseShape,
    operator: z.literal("not_in"),
    value: z.array(ScalarValueZ),
  }).strict(),
  z.object({
    ...BranchRuleBaseShape,
    operator: z.literal("exists"),
  }).strict(),
  z.object({
    ...BranchRuleBaseShape,
    operator: z.literal("missing"),
  }).strict(),
]);

export const QuestionNodeZ = z.object({
  id: z.string().min(1),
  type: QuestionTypeZ,
  title: z.string().min(1),
  body: z.string().optional(),
  variableName: z.string().min(1).nullable().optional(),
  required: z.boolean().optional(),
  options: z.array(OptionZ).optional(),
  nextNodeId: z.string().min(1).optional(),
  branches: z.array(BranchRuleZ).optional(),
  scale: ScaleMetadataZ.optional(),
  pii: PiiClassificationZ.optional(),
  metadata: MetadataZ.optional(),
}).strict();

export const EdgeZ = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  condition: BranchRuleZ.optional(),
  metadata: MetadataZ.optional(),
}).strict();

export const SurveySchemaZ = z.object({
  schemaVersion: z.literal("0.0.1"),
  survey: SurveyMetadataZ,
  policy: SurveyPolicyZ,
  consent: ConsentBlockZ.optional(),
  variables: z.array(VariableDefinitionZ),
  nodes: z.array(QuestionNodeZ),
  edges: z.array(EdgeZ),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export type SurveySchema = z.infer<typeof SurveySchemaZ>;
export type QuestionNode = z.infer<typeof QuestionNodeZ>;
export type VariableDefinition = z.infer<typeof VariableDefinitionZ>;
export type SurveyPolicy = z.infer<typeof SurveyPolicyZ>;
export type ConsentBlock = z.infer<typeof ConsentBlockZ>;
export type Option = z.infer<typeof OptionZ>;
export type BranchRule = z.infer<typeof BranchRuleZ>;
export type Edge = z.infer<typeof EdgeZ>;
