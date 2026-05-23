import { UserRole, type User } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/persistence/repositories";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication is required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Publisher access is required") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function shouldTrustTestUser() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_TRUST_TEST_USER === "true" &&
    Boolean(process.env.AUTH_TEST_USER_EMAIL)
  );
}

export async function getCurrentUser(): Promise<User | null> {
  if (shouldTrustTestUser()) {
    return prisma.user.upsert({
      where: { email: process.env.AUTH_TEST_USER_EMAIL as string },
      create: {
        email: process.env.AUTH_TEST_USER_EMAIL as string,
        role: UserRole.publisher,
      },
      update: {},
    });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export async function requirePublisher(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  if (user.role !== UserRole.publisher) {
    throw new ForbiddenError();
  }

  return user;
}
