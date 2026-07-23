-- Speed up admin feedback inbox sorting and status-filtered pagination.
CREATE INDEX "feedback_threads_updatedAt_idx"
ON "feedback_threads"("updatedAt");

CREATE INDEX "feedback_threads_status_updatedAt_idx"
ON "feedback_threads"("status", "updatedAt");
