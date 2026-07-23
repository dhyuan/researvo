-- CreateTable
CREATE TABLE "admin_push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expirationTime" BIGINT,
    "userAgent" TEXT,
    "adminAuthVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_push_events" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'user_feedback_message',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_push_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_push_deliveries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_push_subscriptions_endpointHash_key"
ON "admin_push_subscriptions"("endpointHash");

-- CreateIndex
CREATE INDEX "admin_push_subscriptions_status_adminAuthVersion_idx"
ON "admin_push_subscriptions"("status", "adminAuthVersion");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_push_events_messageId_key"
ON "feedback_push_events"("messageId");

-- CreateIndex
CREATE INDEX "feedback_push_events_status_nextAttemptAt_idx"
ON "feedback_push_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_push_deliveries_eventId_subscriptionId_key"
ON "feedback_push_deliveries"("eventId", "subscriptionId");

-- CreateIndex
CREATE INDEX "feedback_push_deliveries_eventId_status_idx"
ON "feedback_push_deliveries"("eventId", "status");

-- AddForeignKey
ALTER TABLE "feedback_push_events"
ADD CONSTRAINT "feedback_push_events_feedbackId_fkey"
FOREIGN KEY ("feedbackId") REFERENCES "feedback_threads"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_push_events"
ADD CONSTRAINT "feedback_push_events_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "feedback_messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_push_deliveries"
ADD CONSTRAINT "feedback_push_deliveries_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "feedback_push_events"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_push_deliveries"
ADD CONSTRAINT "feedback_push_deliveries_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "admin_push_subscriptions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
