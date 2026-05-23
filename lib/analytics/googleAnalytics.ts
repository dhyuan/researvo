const DYNAMIC_SEGMENT_PATTERNS = [/^cmp[a-z0-9]+$/i, /^[0-9a-f]{24}$/i, /^[0-9a-f-]{32,36}$/i];
const SITE_TITLE = "Researvo";
const DEFAULT_DOCUMENT_TITLES = new Set([SITE_TITLE, `${SITE_TITLE} | ${SITE_TITLE}`]);
export const SSO_PROVIDER_COOKIE = "researvo_sso_provider";
const ANALYTICS_TITLE_BY_PATTERN: Record<string, string> = {
  "/": `Sign In | ${SITE_TITLE}`,
  "/profile": `Profile | ${SITE_TITLE}`,
  "/settings": `Settings | ${SITE_TITLE}`,
  "/surveys/[id]": `Survey Editor | ${SITE_TITLE}`,
  "/surveys/new": `Create Survey | ${SITE_TITLE}`,
  "/surveys/new/wizard": `New Survey Wizard | ${SITE_TITLE}`,
  "/workspace": `Workspace | ${SITE_TITLE}`,
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getPathSegments(pathname: string) {
  return pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
}

function isDynamicSegment(segment: string) {
  return DYNAMIC_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment));
}

export function getPageName(pathname: string) {
  const segments = getPathSegments(pathname).map((segment) => (isDynamicSegment(segment) ? "detail" : segment));

  return segments.length > 0 ? segments.join("_") : "home";
}

export function getPagePattern(pathname: string) {
  const originalSegments = getPathSegments(pathname);
  const segments = originalSegments.map((segment, index) => {
    if (originalSegments[0] === "surveys" && originalSegments.length === 2 && originalSegments[1] !== "new") {
      return index === 1 ? "[id]" : segment;
    }

    if (originalSegments[0] === "public" && originalSegments[1] === "s" && originalSegments.length === 3) {
      return index === 2 ? "[id]" : segment;
    }

    return isDynamicSegment(segment) ? "[id]" : segment;
  });

  return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

export function getAnalyticsPageTitle(pathname: string, documentTitle: string) {
  const pagePattern = getPagePattern(pathname);

  if (pagePattern === "/public/s/[id]") {
    return documentTitle && !DEFAULT_DOCUMENT_TITLES.has(documentTitle) ? documentTitle : `Survey | ${SITE_TITLE}`;
  }

  return ANALYTICS_TITLE_BY_PATTERN[pagePattern] ?? (documentTitle || SITE_TITLE);
}

export function buildPageViewEventParameters({
  documentTitle,
  pageLocation,
  pathname,
}: {
  documentTitle: string;
  pageLocation: string;
  pathname: string;
}) {
  return {
    page_location: pageLocation,
    page_path: pathname,
    page_pattern: getPagePattern(pathname),
    page_title: getAnalyticsPageTitle(pathname, documentTitle),
    page_name: getPageName(pathname),
  };
}

function getCookieValue(cookieString: string, name: string) {
  return cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function buildSsoLoginEventParameters(searchParams: URLSearchParams, cookieString: string) {
  const authStatus = searchParams.get("auth_status");
  const authError = searchParams.get("error");

  if (authStatus !== "success" && !authError) {
    return null;
  }

  const provider = searchParams.get("auth_provider") ?? getCookieValue(cookieString, SSO_PROVIDER_COOKIE) ?? "unknown";

  return {
    ...(authError ? { auth_error: authError } : {}),
    auth_status: authStatus === "success" ? "success" : "failure",
    sso_provider: provider,
  };
}

export function getButtonName(element: Element) {
  const explicitLabel = element.getAttribute("data-analytics-label");
  if (explicitLabel) {
    return normalizeName(explicitLabel);
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return normalizeName(ariaLabel);
  }

  const title = element.getAttribute("title");
  if (title) {
    return normalizeName(title);
  }

  const text = element.textContent;
  if (text) {
    return normalizeName(text);
  }

  return "unnamed_button";
}

export function buildPageButtonName(pageName: string, buttonName: string) {
  return `${pageName}+${buttonName}`;
}
