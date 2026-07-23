import { createHash } from "node:crypto";

import { prisma } from "@/lib/persistence/repositories";
import { getAdminAuthVersion } from "@/lib/push/pushConfig";

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function hashPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function currentAuthVersion() {
  const adminAuthVersion = getAdminAuthVersion();
  if (!adminAuthVersion) {
    throw new Error("Feedback admin access is not configured");
  }
  return adminAuthVersion;
}

export async function upsertAdminPushSubscription(
  input: PushSubscriptionInput,
  userAgent?: string | null,
) {
  const endpointHash = hashPushEndpoint(input.endpoint);
  return prisma.adminPushSubscription.upsert({
    where: { endpointHash },
    create: {
      endpoint: input.endpoint,
      endpointHash,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      expirationTime:
        input.expirationTime === null ? null : BigInt(Math.trunc(input.expirationTime)),
      userAgent: userAgent || null,
      adminAuthVersion: currentAuthVersion(),
      status: "active",
    },
    update: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      expirationTime:
        input.expirationTime === null ? null : BigInt(Math.trunc(input.expirationTime)),
      userAgent: userAgent || null,
      adminAuthVersion: currentAuthVersion(),
      status: "active",
      failureCount: 0,
      lastFailureAt: null,
    },
    select: { id: true },
  });
}

export async function disableAdminPushSubscription(endpoint: string) {
  return prisma.adminPushSubscription.updateMany({
    where: {
      endpointHash: hashPushEndpoint(endpoint),
      adminAuthVersion: currentAuthVersion(),
    },
    data: { status: "unsubscribed" },
  });
}

export async function invalidateAdminPushSubscription(endpoint: string) {
  return prisma.adminPushSubscription.updateMany({
    where: {
      endpointHash: hashPushEndpoint(endpoint),
      adminAuthVersion: currentAuthVersion(),
    },
    data: {
      status: "invalidated",
      failureCount: { increment: 1 },
      lastFailureAt: new Date(),
    },
  });
}

export async function findCurrentAdminPushSubscription(endpoint: string) {
  return prisma.adminPushSubscription.findFirst({
    where: {
      endpointHash: hashPushEndpoint(endpoint),
      adminAuthVersion: currentAuthVersion(),
      status: "active",
    },
  });
}

export async function listCurrentActivePushSubscriptions() {
  const adminAuthVersion = getAdminAuthVersion();
  if (!adminAuthVersion) {
    return [];
  }

  return prisma.adminPushSubscription.findMany({
    where: {
      adminAuthVersion,
      status: "active",
    },
  });
}
