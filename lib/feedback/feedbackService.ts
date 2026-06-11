import { prisma } from "@/lib/persistence/repositories";

export type SubmitFeedbackInput = {
  token: string;
  sourceApp: string;
  message: string;
};

export async function submitFeedback(input: SubmitFeedbackInput) {
  const app = await prisma.feedbackApp.findUnique({
    where: { sourceApp: input.sourceApp },
  });

  if (!app || app.token !== input.token) {
    return null;
  }

  return prisma.feedbackEntry.create({
    data: {
      feedbackAppId: app.id,
      sourceApp: app.sourceApp,
      message: input.message,
    },
    select: {
      id: true,
    },
  });
}
