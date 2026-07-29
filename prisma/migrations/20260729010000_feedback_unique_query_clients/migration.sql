-- Track distinct app installations that queried the cached feedback thread API.
-- Only a one-way hash of installId is persisted.
CREATE TABLE "feedback_query_clients" (
    "sourceApp" TEXT NOT NULL,
    "installIdHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_query_clients_pkey" PRIMARY KEY ("sourceApp", "installIdHash")
);
