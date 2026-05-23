import { prisma } from "@/lib/persistence/repositories";

export type PublisherProfileInput = {
  displayName?: string | null;
  industry?: string | null;
  researchField?: string | null;
  organization?: string | null;
  intendedUse?: string | null;
  region?: string | null;
};

export async function getPublisherProfile(userId: string) {
  return prisma.publisherProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updatePublisherProfile(userId: string, input: PublisherProfileInput) {
  const data = {
    ...input,
    onboardingCompleted: true,
  };

  return prisma.publisherProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  });
}
