-- Persist approximate feedback cache usage in batches.
CREATE TABLE "feedback_metrics" (
    "key" TEXT NOT NULL,
    "total" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_metrics_pkey" PRIMARY KEY ("key")
);
