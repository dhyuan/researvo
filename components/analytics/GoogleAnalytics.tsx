"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

import {
  SSO_PROVIDER_COOKIE,
  buildPageViewEventParameters,
  buildSsoLoginEventParameters,
  buildPageButtonName,
  getButtonName,
  getPageName,
  getPagePattern,
} from "@/lib/analytics/googleAnalytics";

const GA_MEASUREMENT_ID = "G-CMKPF2B2RL";

declare global {
  interface Window {
    __researvoGaInitialized?: boolean;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function trackPageView(pathname: string) {
  const gtag = initializeGoogleAnalytics();

  gtag("event", "page_view", buildPageViewEventParameters({
    documentTitle: document.title,
    pageLocation: window.location.href,
    pathname,
  }));
}

function trackButtonClick(target: Element, pathname: string) {
  const gtag = initializeGoogleAnalytics();

  const buttonName = getButtonName(target);
  const pageName = getPageName(pathname);

  gtag("event", "button_click", {
    page_location: window.location.href,
    page_path: pathname,
    page_pattern: getPagePattern(pathname),
    page_name: pageName,
    button_name: buttonName,
    page_button_name: buildPageButtonName(pageName, buttonName),
  });
}

function trackSsoLogin(params: ReturnType<typeof buildSsoLoginEventParameters>) {
  if (!params) {
    return;
  }

  const gtag = initializeGoogleAnalytics();

  gtag("event", "sso_login", params);
}

function initializeGoogleAnalytics() {
  if (window.__researvoGaInitialized && window.gtag) {
    return window.gtag;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  window.__researvoGaInitialized = true;

  return window.gtag;
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathRef = useRef<string | null>(null);
  const lastTrackedSsoResultRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastTrackedPathRef.current === pathname) {
      return;
    }

    lastTrackedPathRef.current = pathname;
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    const result = buildSsoLoginEventParameters(searchParams, document.cookie);
    const resultKey = result ? `${result.auth_status}:${result.sso_provider}:${result.auth_error ?? ""}` : null;

    if (!result || lastTrackedSsoResultRef.current === resultKey) {
      return;
    }

    lastTrackedSsoResultRef.current = resultKey;
    trackSsoLogin(result);

    document.cookie = `${SSO_PROVIDER_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;

    const cleanedUrl = new URL(window.location.href);
    cleanedUrl.searchParams.delete("auth_status");
    cleanedUrl.searchParams.delete("auth_provider");
    cleanedUrl.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`);
  }, [searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("button, a[data-slot='button']") : null;

      if (!target) {
        return;
      }

      trackButtonClick(target, pathname);
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [pathname]);

  return (
    <>
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag("js", new Date());
gtag("config", "${GA_MEASUREMENT_ID}", { send_page_view: false });
window.__researvoGaInitialized = true;
          `.trim(),
        }}
      />
      <Script
        id="google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
