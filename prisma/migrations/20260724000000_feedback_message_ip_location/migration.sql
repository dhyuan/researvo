-- Add IP geolocation metadata for user feedback messages.
ALTER TABLE "feedback_messages"
ADD COLUMN "ipLocation" JSONB;
