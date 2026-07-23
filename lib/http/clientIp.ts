export function getClientIp(headers: Headers) {
  const forwardedFor = headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  const ipAddress =
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    forwardedFor;

  return ipAddress || undefined;
}
