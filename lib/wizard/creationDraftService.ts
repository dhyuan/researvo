import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/persistence/repositories";
import { SurveySchemaZ, type SurveySchema } from "@/lib/schema/surveySchema";

export type CreationDraftInput = {
  title?: string;
  description?: string;
  researchGoal?: string;
  questionDescription?: string;
  constraints?: string;
  schema?: unknown;
};

type JsonSafeValue =
  | string
  | number
  | boolean
  | null
  | JsonSafeValue[]
  | { [key: string]: JsonSafeValue };

type CreationDraftUpdateData = {
  title?: string;
  description?: string;
  researchGoal?: string;
  questionDescription?: string;
  constraints?: string;
  schema?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

const surveySchemaJson = (schema: SurveySchema): Prisma.InputJsonValue => schema as unknown as Prisma.InputJsonValue;

type PersistedCreationDraft = {
  createdSurveyId: string | null;
  description: string | null;
  id: string;
  schema: unknown;
  title: string | null;
};

function assertJsonSafe(value: unknown, path = "schema"): asserts value is JsonSafeValue {
  if (value === null) {
    return;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return;
    }

    throw new TypeError(`${path} must be JSON-safe`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}.${index}`));
    return;
  }

  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`${path} must be JSON-safe`);
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      assertJsonSafe(item, `${path}.${key}`);
    });
    return;
  }

  throw new TypeError(`${path} must be JSON-safe`);
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  assertJsonSafe(value);
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function creationDraftUpdateData(input: CreationDraftInput): CreationDraftUpdateData {
  const data: CreationDraftUpdateData = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.researchGoal !== undefined) data.researchGoal = input.researchGoal;
  if (input.questionDescription !== undefined) data.questionDescription = input.questionDescription;
  if (input.constraints !== undefined) data.constraints = input.constraints;
  if (input.schema !== undefined) data.schema = toPrismaJsonValue(input.schema);

  return data;
}

const schemaForCreationDraft = (draft: PersistedCreationDraft, schema: SurveySchema): SurveySchema => ({
  ...schema,
  survey: {
    ...schema.survey,
    title: draft.title || schema.survey.title,
    description: draft.description || schema.survey.description,
  },
});

async function ensureSurveyDraftForImportedSchema(
  tx: Prisma.TransactionClient,
  ownerId: string,
  draft: PersistedCreationDraft,
) {
  const schemaResult = SurveySchemaZ.safeParse(draft.schema);

  if (!schemaResult.success) {
    return draft;
  }

  const schema = schemaForCreationDraft(draft, schemaResult.data);

  if (!draft.createdSurveyId) {
    const survey = await tx.survey.create({
      data: {
        ownerId,
        title: schema.survey.title,
      },
    });

    await tx.surveyDraft.create({
      data: {
        surveyId: survey.id,
        schema: surveySchemaJson(schema),
      },
    });

    return tx.surveyCreationDraft.update({
      where: { id: draft.id },
      data: { createdSurveyId: survey.id },
    });
  }

  await tx.survey.update({
    where: { id: draft.createdSurveyId },
    data: { title: schema.survey.title },
  });

  const latestSurveyDraft = await tx.surveyDraft.findFirst({
    where: { surveyId: draft.createdSurveyId },
    orderBy: { updatedAt: "desc" },
  });

  if (latestSurveyDraft) {
    await tx.surveyDraft.update({
      where: { id: latestSurveyDraft.id },
      data: { schema: surveySchemaJson(schema) },
    });
  } else {
    await tx.surveyDraft.create({
      data: {
        surveyId: draft.createdSurveyId,
        schema: surveySchemaJson(schema),
      },
    });
  }

  return draft;
}

export async function getOrCreateActiveCreationDraft(ownerId: string) {
  const existing = await prisma.surveyCreationDraft.findFirst({
    where: {
      ownerId,
      status: "draft",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    if (existing.createdSurveyId) {
      const publishedVersion = await prisma.surveyVersion.findFirst({
        where: { surveyId: existing.createdSurveyId },
        orderBy: { version: "desc" },
      });

      if (publishedVersion) {
        await completeCreationDraftForSurvey(ownerId, existing.createdSurveyId);

        return prisma.surveyCreationDraft.create({
          data: { ownerId },
        });
      }
    }

    return existing;
  }

  return prisma.surveyCreationDraft.create({
    data: { ownerId },
  });
}

export async function getOwnedCreationDraft(ownerId: string, draftId: string) {
  return prisma.surveyCreationDraft.findFirst({
    where: { id: draftId, ownerId },
  });
}

export async function completeCreationDraftForSurvey(ownerId: string, surveyId: string) {
  return prisma.surveyCreationDraft.updateMany({
    where: { ownerId, createdSurveyId: surveyId, status: "draft" },
    data: { status: "converted" },
  });
}

export async function updateCreationDraft(ownerId: string, draftId: string, input: CreationDraftInput) {
  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.surveyCreationDraft.updateMany({
      where: { id: draftId, ownerId, status: "draft" },
      data: creationDraftUpdateData(input),
    });

    if (updateResult.count === 0) {
      return null;
    }

    const draft = await tx.surveyCreationDraft.findFirst({
      where: { id: draftId, ownerId },
    });

    if (!draft) {
      return null;
    }

    return ensureSurveyDraftForImportedSchema(tx, ownerId, draft);
  });
}

export async function finalizeCreationDraft(ownerId: string, draftId: string) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.surveyCreationDraft.findFirst({
      where: { id: draftId, ownerId },
    });

    if (!draft) {
      return { ok: false as const, error: "DRAFT_NOT_FOUND" };
    }

    if (draft.createdSurveyId) {
      return { ok: true as const, surveyId: draft.createdSurveyId };
    }

    if (draft.status !== "draft") {
      return { ok: false as const, error: "DRAFT_NOT_FOUND" };
    }

    const schemaResult = SurveySchemaZ.safeParse(draft.schema);

    if (!schemaResult.success) {
      return { ok: false as const, error: "INVALID_SCHEMA", issues: schemaResult.error.issues };
    }

    const claim = await tx.surveyCreationDraft.updateMany({
      where: { id: draftId, ownerId, status: "draft", createdSurveyId: null },
      data: { status: "finalizing" },
    });

    if (claim.count === 0) {
      const currentDraft = await tx.surveyCreationDraft.findFirst({
        where: { id: draftId, ownerId },
      });

      if (currentDraft?.createdSurveyId) {
        return { ok: true as const, surveyId: currentDraft.createdSurveyId };
      }

      return { ok: false as const, error: "DRAFT_NOT_FOUND" };
    }

    const schema = schemaForCreationDraft(draft, schemaResult.data);

    const survey = await tx.survey.create({
      data: {
        ownerId,
        title: schema.survey.title,
      },
    });

    await tx.surveyDraft.create({
      data: {
        surveyId: survey.id,
        schema: surveySchemaJson(schema),
      },
    });

    await tx.surveyCreationDraft.update({
      where: { id: draftId },
      data: {
        createdSurveyId: survey.id,
        status: "converted",
      },
    });

    return { ok: true as const, surveyId: survey.id };
  });
}
