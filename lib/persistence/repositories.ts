import { Prisma, PrismaClient } from "@prisma/client";

import type { SurveySchema } from "@/lib/schema/surveySchema";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type CreateSurveyDraftInput = {
  ownerId: string;
  title: string;
  schema: SurveySchema;
};

export type CreateSurveyVersionInput = {
  surveyId: string;
  version: number;
  publicId: string;
  schema: SurveySchema;
};

export type SubmissionInput = {
  answers: Prisma.InputJsonValue;
  shownNodeIds: Prisma.InputJsonValue;
  branchPath: Prisma.InputJsonValue;
};

const surveySchemaJson = (schema: SurveySchema): Prisma.InputJsonValue =>
  schema as unknown as Prisma.InputJsonValue;

export async function createSurveyDraft(input: CreateSurveyDraftInput) {
  return prisma.$transaction(async (tx) => {
    const survey = await tx.survey.create({
      data: {
        ownerId: input.ownerId,
        title: input.title,
      },
    });

    const draft = await tx.surveyDraft.create({
      data: {
        surveyId: survey.id,
        schema: surveySchemaJson(input.schema),
      },
    });

    return { survey, draft };
  });
}

export async function getSurveyDraft(surveyId: string) {
  return prisma.surveyDraft.findFirst({
    where: { surveyId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getLatestSurveyVersion(surveyId: string) {
  return prisma.surveyVersion.findFirst({
    where: { surveyId },
    orderBy: { version: "desc" },
  });
}

export async function getOwnedSurveyDraft(userId: string, surveyId: string) {
  return prisma.surveyDraft.findFirst({
    where: {
      surveyId,
      survey: {
        ownerId: userId,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listSurveysForOwner(ownerId: string) {
  return prisma.survey.findMany({
    where: { ownerId },
    include: {
      drafts: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      versions: {
        include: {
          _count: {
            select: {
              sessions: true,
            },
          },
        },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function archiveSurvey(surveyId: string) {
  return prisma.survey.update({
    where: { id: surveyId },
    data: { archivedAt: new Date() },
  });
}

export async function deleteSurvey(surveyId: string) {
  return prisma.$transaction(async (tx) => {
    const versions = await tx.surveyVersion.findMany({
      where: { surveyId },
      select: { id: true },
    });
    const versionIds = versions.map((version) => version.id);
    const sessions = await tx.respondentSession.findMany({
      where: { surveyVersionId: { in: versionIds } },
      select: { id: true },
    });
    const sessionIds = sessions.map((session) => session.id);

    await tx.submissionRecord.deleteMany({
      where: { respondentSessionId: { in: sessionIds } },
    });
    await tx.respondentSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    await tx.surveyVersion.deleteMany({
      where: { surveyId },
    });
    await tx.surveyDraft.deleteMany({
      where: { surveyId },
    });
    await tx.surveyCreationDraft.updateMany({
      where: { createdSurveyId: surveyId },
      data: { createdSurveyId: null },
    });

    return tx.survey.delete({
      where: { id: surveyId },
    });
  });
}

// Updates the latest draft for a survey, or creates the first draft if none exists.
export async function saveSurveyDraft(surveyId: string, schema: SurveySchema) {
  const latestDraft = await getSurveyDraft(surveyId);

  if (!latestDraft) {
    return prisma.surveyDraft.create({
      data: {
        surveyId,
        schema: surveySchemaJson(schema),
      },
    });
  }

  return prisma.surveyDraft.update({
    where: { id: latestDraft.id },
    data: { schema: surveySchemaJson(schema) },
  });
}

export async function createSurveyVersion(input: CreateSurveyVersionInput) {
  return prisma.surveyVersion.create({
    data: {
      surveyId: input.surveyId,
      version: input.version,
      publicId: input.publicId,
      schema: surveySchemaJson(input.schema),
    },
  });
}

export async function getSurveyVersionByPublicId(publicId: string) {
  return prisma.surveyVersion.findUnique({
    where: { publicId },
    include: {
      survey: true,
    },
  });
}

export async function createRespondentSession(surveyVersionId: string) {
  return prisma.respondentSession.create({
    data: {
      surveyVersionId,
      status: "started",
    },
  });
}

export async function completeRespondentSession(
  sessionId: string,
  submission: SubmissionInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.respondentSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        submittedAt: new Date(),
      },
    });

    return tx.submissionRecord.create({
      data: {
        respondentSessionId: sessionId,
        answers: submission.answers,
        shownNodeIds: submission.shownNodeIds,
        branchPath: submission.branchPath,
      },
    });
  });
}

export async function listSubmissionsForSurvey(surveyId: string) {
  return prisma.submissionRecord.findMany({
    where: {
      respondentSession: {
        surveyVersion: {
          surveyId,
        },
      },
    },
    include: {
      respondentSession: {
        include: {
          surveyVersion: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
