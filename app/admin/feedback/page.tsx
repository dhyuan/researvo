import type { Metadata } from "next";

import { FeedbackInboxClient } from "@/components/feedback-admin/FeedbackInboxClient";

export const metadata: Metadata = {
  title: "Feedback inbox",
  robots: { index: false, follow: false },
};

export default function FeedbackAdminPage() {
  return <FeedbackInboxClient />;
}
