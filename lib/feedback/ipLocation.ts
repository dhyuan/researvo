import { prisma } from "@/lib/persistence/repositories";

type IpWhoisResponse = {
  success?: boolean;
  message?: string;
  ip?: string;
  type?: string;
  continent?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: {
    id?: string;
  };
  connection?: {
    asn?: number;
    org?: string;
    isp?: string;
    domain?: string;
  };
};

export type FeedbackIpLocation = {
  provider: "ipwho.is";
  ip: string;
  type?: string;
  continent?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asn?: number;
  org?: string;
  isp?: string;
  domain?: string;
  lookedUpAt: string;
};

const LOOKUP_TIMEOUT_MS = 2500;

function isPrivateIp(ipAddress: string) {
  const normalized = ipAddress.trim().toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  const parts = normalized.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function compactLocation(input: IpWhoisResponse, ipAddress: string): FeedbackIpLocation | null {
  if (input.success === false) {
    return null;
  }

  return {
    provider: "ipwho.is",
    ip: input.ip ?? ipAddress,
    type: input.type,
    continent: input.continent,
    country: input.country,
    countryCode: input.country_code,
    region: input.region,
    city: input.city,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone?.id,
    asn: input.connection?.asn,
    org: input.connection?.org,
    isp: input.connection?.isp,
    domain: input.connection?.domain,
    lookedUpAt: new Date().toISOString(),
  };
}

async function lookupIpLocation(ipAddress: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}?lang=zh-CN`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as IpWhoisResponse;
    return compactLocation(data, ipAddress);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichMessageIpLocation(messageId: string, ipAddress?: string | null) {
  if (!ipAddress || isPrivateIp(ipAddress)) {
    return;
  }

  const location = await lookupIpLocation(ipAddress);
  if (!location) {
    return;
  }

  try {
    await prisma.feedbackMessage.updateMany({
      where: { id: messageId },
      data: {
        ipLocation: location,
      },
    });
  } catch {
    // Feedback submission should never be affected by best-effort enrichment.
  }
}
