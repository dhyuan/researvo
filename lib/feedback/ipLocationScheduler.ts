import { after } from "next/server";

import { enrichMessageIpLocation } from "@/lib/feedback/ipLocation";

export function scheduleFeedbackIpLocation(messageId: string, ipAddress?: string | null) {
  if (!ipAddress) {
    return;
  }

  after(async () => {
    await enrichMessageIpLocation(messageId, ipAddress);
  });
}
