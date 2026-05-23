import { ForbiddenError } from "@/lib/auth/currentUser";
import { prisma } from "@/lib/persistence/repositories";

export async function requireOwnedSurvey(userId: string, surveyId: string) {
  const survey = await prisma.survey.findFirst({
    where: {
      id: surveyId,
      ownerId: userId,
    },
  });

  if (!survey) {
    throw new ForbiddenError("Survey access is required");
  }

  return survey;
}
