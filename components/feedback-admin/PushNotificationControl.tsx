"use client";

import {
  Bell,
  BellRinging,
  CheckCircle,
  DeviceMobile,
  Flask,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { base64UrlToUint8Array, isIosDevice } from "@/lib/pwa/adminPush";
import { cn } from "@/lib/utils";

type PushState =
  | "checking"
  | "insecure"
  | "unsupported"
  | "ios-install-required"
  | "not-configured"
  | "denied"
  | "disabled"
  | "enabled";

type PublicKeyResponse = {
  configured: boolean;
  publicKey?: string;
};

function responseMessage(response: Response, fallback: string) {
  if (response.status === 401) return "后台登录已过期，请重新登录后再试。";
  return fallback;
}

export function PushNotificationControl() {
  const pathname = usePathname();
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const getRegistration = useCallback(async () => {
    const current = await navigator.serviceWorker.getRegistration("/admin/");
    return current ?? navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
  }, []);

  const persistSubscription = useCallback(async (subscription: PushSubscription) => {
    const response = await fetch("/api/admin/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) {
      throw new Error(responseMessage(response, "无法保存这台设备的通知订阅。"));
    }
  }, []);

  const inspect = useCallback(async () => {
    if (!window.isSecureContext) {
      setState("insecure");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }

    const ios = isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (ios && !standalone) {
      setState("ios-install-required");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const [keyResponse, registration] = await Promise.all([
        fetch("/api/admin/push/public-key", { cache: "no-store" }),
        getRegistration(),
      ]);
      if (!keyResponse.ok) {
        setMessage(responseMessage(keyResponse, "暂时无法检查通知配置。"));
        setState("disabled");
        return;
      }

      const key = (await keyResponse.json()) as PublicKeyResponse;
      if (!key.configured || !key.publicKey) {
        setState("not-configured");
        return;
      }

      setPublicKey(key.publicKey);
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await persistSubscription(subscription);
      }
      setState(subscription ? "enabled" : "disabled");
    } catch {
      setMessage("暂时无法检查通知状态，请确认网络连接。");
      setState("disabled");
    }
  }, [getRegistration, persistSubscription]);

  useEffect(() => {
    if (pathname !== "/admin/feedback") return;
    const timeout = window.setTimeout(() => void inspect(), 0);
    return () => window.clearTimeout(timeout);
  }, [inspect, pathname]);

  async function enable() {
    if (busy || !publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("denied");
        return;
      }
      if (permission !== "granted") {
        setMessage("尚未允许通知。你可以稍后再次开启。");
        return;
      }

      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      const created = !subscription;
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });

      try {
        await persistSubscription(subscription);
      } catch (error) {
        if (created) await subscription.unsubscribe().catch(() => false);
        throw error;
      }

      setState("enabled");
      setExpanded(true);
      setMessage("新消息提醒已开启。通知不会显示用户反馈正文。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "开启通知失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/admin/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        if (!response.ok) {
          throw new Error(responseMessage(response, "服务器未能关闭这台设备的提醒。"));
        }
        await subscription.unsubscribe();
      }
      if ("clearAppBadge" in navigator && typeof navigator.clearAppBadge === "function") {
        await navigator.clearAppBadge().catch(() => undefined);
      }
      setState("disabled");
      setExpanded(false);
      setMessage("这台设备的新消息提醒已关闭。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "关闭通知失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState("disabled");
        throw new Error("这台设备当前没有有效订阅，请重新开启提醒。");
      }
      const response = await fetch("/api/admin/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) throw new Error(responseMessage(response, "测试通知发送失败。"));
      setMessage("测试通知已发送，请留意系统通知中心。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试通知发送失败。");
    } finally {
      setBusy(false);
    }
  }

  if (pathname !== "/admin/feedback") return null;

  const blocked = ["insecure", "unsupported", "ios-install-required", "not-configured", "denied"].includes(state);
  const blockedCopy: Partial<Record<PushState, { title: string; body: string }>> = {
    insecure: {
      title: "需要 HTTPS",
      body: "手机通过局域网 HTTP 地址访问时无法使用后台通知，请改用 HTTPS 部署地址。",
    },
    unsupported: {
      title: "当前浏览器不支持",
      body: "这台设备无法使用 Service Worker Push，请继续使用页面内消息刷新。",
    },
    "ios-install-required": {
      title: "先添加到主屏幕",
      body: "在 iPhone 上点浏览器的“分享”→“添加到主屏幕”，再从桌面图标打开并开启通知。",
    },
    "not-configured": {
      title: "推送服务尚未配置",
      body: "服务器需要先配置 VAPID 密钥，之后这台设备才能订阅通知。",
    },
    denied: {
      title: "通知已被浏览器阻止",
      body: "请到系统或浏览器的网站设置中允许通知，然后重新打开此后台。",
    },
  };

  const copy = blockedCopy[state];

  if (state === "checking") {
    return (
      <div className="fixed bottom-4 right-4 z-50 rounded-full border border-[#d3dad4] bg-white/95 px-3 py-2 text-xs text-[#68736d] shadow-lg backdrop-blur">
        正在检查新消息提醒…
      </div>
    );
  }

  if (!expanded) {
    const compactLabel = copy?.title ?? (state === "enabled" ? "提醒已开启" : "开启新消息提醒");
    return (
      <button
        className={cn(
          "fixed bottom-4 right-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-[0_14px_35px_-18px_rgba(16,42,34,.72)] transition hover:-translate-y-0.5",
          state === "enabled"
            ? "border-[#b9d4c6] bg-[#e8f2ed] text-[#245a4c]"
            : blocked
              ? "border-[#d8d3c8] bg-[#f8f4ea] text-[#755b2f]"
              : "border-[#2b5549] bg-[#22332c] text-white",
        )}
        onClick={() => state === "disabled" ? void enable() : setExpanded(true)}
        type="button"
      >
        {state === "enabled" ? <CheckCircle size={18} weight="fill" /> : <Bell size={18} weight="duotone" />}
        {busy ? "正在开启…" : compactLabel}
      </button>
    );
  }

  return (
    <aside
      aria-label="新消息提醒设置"
      className="fixed inset-x-3 bottom-3 z-50 ml-auto max-w-[360px] overflow-hidden rounded-2xl border border-[#cfd7d1] bg-[#fbfcf9]/97 text-[#1d2823] shadow-[0_24px_70px_-24px_rgba(15,39,31,.55)] backdrop-blur sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px]"
    >
      <div className="border-b border-[#e0e5e0] bg-[#22332c] px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[#d9e9e1]">
              {state === "ios-install-required" ? <DeviceMobile size={20} /> : <BellRinging size={20} weight="duotone" />}
            </span>
            <div>
              <h2 className="text-sm font-semibold">{copy?.title ?? "新消息提醒"}</h2>
              <p className="mt-1 text-[11px] leading-4 text-[#aebfb6]">Researvo Feedback Admin</p>
            </div>
          </div>
          <button
            aria-label="收起通知设置"
            className="rounded-md p-1 text-[#b8c7bf] transition hover:bg-white/10 hover:text-white"
            onClick={() => setExpanded(false)}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {copy ? (
          <div className="flex gap-3 text-sm leading-6 text-[#56635d]">
            <WarningCircle className="mt-1 shrink-0 text-[#9c6b29]" size={18} weight="duotone" />
            <p>{copy.body}</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 shrink-0 text-[#2c725f]" size={19} weight="fill" />
              <div>
                <p className="text-sm font-medium">此设备可以接收后台推送</p>
                <p className="mt-1 text-xs leading-5 text-[#6f7a74]">
                  页面关闭后仍可收到匿名提醒；锁屏上不会显示反馈正文。
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button disabled={busy} onClick={() => void sendTest()} size="sm" variant="outline">
                <Flask size={15} />
                {busy ? "请稍候…" : "发送测试"}
              </Button>
              <Button disabled={busy} onClick={() => void disable()} size="sm" variant="danger">
                关闭提醒
              </Button>
            </div>
          </>
        )}

        {message ? (
          <p className="mt-4 rounded-lg border border-[#dce2dd] bg-white px-3 py-2.5 text-xs leading-5 text-[#526059]" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
