"use client";

import {
  ArrowClockwise,
  ArrowLeft,
  ChatCircleDots,
  Check,
  FloppyDisk,
  FunnelSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  SignOut,
  Tray,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PushNotificationControl } from "@/components/feedback-admin/PushNotificationControl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackStatus = "open" | "replied" | "resolved" | "ignored";
type ViewStatus = "all" | "needs" | FeedbackStatus;

type InboxItem = {
  id: string;
  sourceApp: string;
  installId: string;
  channel: string;
  device: string | null;
  appVersion: string | null;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  needsAdminReply: boolean;
  latestMessage: {
    body: string;
    senderType: string;
    createdAt: string;
  } | null;
};

type Message = {
  id: string;
  feedbackId: string;
  senderType: string;
  body: string;
  appVersion: string | null;
  ipAddress: string | null;
  ipLocation: {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    isp?: string;
    org?: string;
    asn?: number;
  } | null;
  createdAt: string;
};

type FeedbackDetail = Omit<InboxItem, "messageCount" | "needsAdminReply" | "latestMessage"> & {
  lastAdminReplyAt: string | null;
  messages: Message[];
};

type InboxResponse = {
  items: InboxItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const statusLabels: Record<FeedbackStatus, string> = {
  open: "待处理",
  replied: "已回复",
  resolved: "已解决",
  ignored: "已忽略",
};

const statusTones: Record<FeedbackStatus, "warning" | "published" | "success" | "neutral"> = {
  open: "warning",
  replied: "published",
  resolved: "success",
  ignored: "neutral",
};

const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SERVICE_WORKER_REFRESH_DEBOUNCE_MS = 300;

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatIpLocation(message: Message) {
  if (!message.ipAddress) return "IP：未记录";
  const location = message.ipLocation;
  if (!location) return `IP：${message.ipAddress} · 地址：查询中`;

  const place = [location.city, location.region, location.country].filter(Boolean).join(" / ");
  const network = [location.isp || location.org, location.asn ? `AS${location.asn}` : null].filter(Boolean).join(" · ");
  return `IP：${message.ipAddress}${place ? ` · 地址：${place}` : ""}${network ? ` · ${network}` : ""}`;
}

function getDeepLinkedThread() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("thread");
}

function InboxSkeleton() {
  return (
    <div className="space-y-px" aria-label="正在加载反馈">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="border-b border-[#e1e4df] px-5 py-5" key={index}>
          <div className="flex justify-between gap-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-4 h-3 w-44" />
        </div>
      ))}
    </div>
  );
}

export function FeedbackInboxClient() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<ViewStatus>("needs");
  const [sourceApp, setSourceApp] = useState("");
  const [channel, setChannel] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(getDeepLinkedThread);
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(() => Boolean(getDeepLinkedThread()));
  const inboxRequestRef = useRef<{ controller: AbortController; sequence: number } | null>(null);
  const detailRequestRef = useRef<{ controller: AbortController; sequence: number } | null>(null);
  const inboxSequenceRef = useRef(0);
  const detailSequenceRef = useRef(0);

  const sourceOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.sourceApp))).sort(),
    [items],
  );
  const channelOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.channel))).sort(),
    [items],
  );

  const redirectToLogin = useCallback(() => {
    const target = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({ next: target });
    router.replace(`/admin/login?${params.toString()}`);
  }, [router]);

  useEffect(() => {
    void fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session: { authenticated: boolean }) => {
        if (!session.authenticated) {
          redirectToLogin();
          return;
        }
        setAuthorized(true);
      })
      .catch(redirectToLogin);
  }, [redirectToLogin]);

  const loadInbox = useCallback(async () => {
    if (!authorized) return;
    inboxRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const sequence = ++inboxSequenceRef.current;
    inboxRequestRef.current = { controller, sequence };
    setLoadingList(true);
    setListError(null);

    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (status !== "all") params.set("status", status === "needs" ? "open" : status);
    if (sourceApp) params.set("sourceApp", sourceApp);
    if (channel) params.set("channel", channel);
    if (query.trim()) params.set("q", query.trim());

    try {
      const response = await fetch(`/api/admin/feedback?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok) throw new Error("LIST_FAILED");

      const data = (await response.json()) as InboxResponse;
      if (sequence !== inboxSequenceRef.current) return;
      const nextItems = status === "needs" ? data.items.filter((item) => item.needsAdminReply) : data.items;
      setItems(nextItems);
      setTotal(status === "needs" ? nextItems.length : data.total);
      setSelectedId((current) => {
        // Keep a deep-linked or manually selected conversation available even
        // when the current inbox filters do not contain it.
        if (current) return current;
        return nextItems[0]?.id ?? null;
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== inboxSequenceRef.current) return;
      setListError("反馈列表加载失败。请检查数据库连接后重试。");
    } finally {
      if (sequence === inboxSequenceRef.current) setLoadingList(false);
    }
  }, [authorized, channel, query, redirectToLogin, sourceApp, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInbox(), query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadInbox, query]);

  const loadDetail = useCallback(async () => {
    if (!authorized) return;
    if (!selectedId) {
      detailRequestRef.current?.controller.abort();
      setDetail(null);
      return;
    }
    detailRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const sequence = ++detailSequenceRef.current;
    detailRequestRef.current = { controller, sequence };
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(selectedId)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok) throw new Error("DETAIL_FAILED");
      const data = (await response.json()) as FeedbackDetail;
      if (sequence !== detailSequenceRef.current) return;
      setDetail(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (sequence !== detailSequenceRef.current) return;
      setDetail(null);
      toast.error("无法读取这条反馈的完整对话。");
    } finally {
      if (sequence === detailSequenceRef.current) setLoadingDetail(false);
    }
  }, [authorized, redirectToLogin, selectedId]);

  useEffect(() => {
    // The selected inbox item is the external key for the detail API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail();
  }, [loadDetail]);

  const refreshVisibleInbox = useCallback(() => {
    if (!authorized || document.visibilityState !== "visible") return;
    void Promise.all([loadInbox(), loadDetail()]);
  }, [authorized, loadDetail, loadInbox]);

  const refreshInbox = useCallback(() => {
    if (!authorized) return;
    void Promise.all([loadInbox(), loadDetail()]);
  }, [authorized, loadDetail, loadInbox]);

  useEffect(() => {
    if (!authorized) return;

    const interval = window.setInterval(refreshVisibleInbox, BACKGROUND_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshVisibleInbox();
    };
    const handleFocus = () => refreshVisibleInbox();
    const handleOnline = () => refreshVisibleInbox();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [authorized, refreshVisibleInbox]);

  useEffect(() => {
    if (!authorized || !("serviceWorker" in navigator)) return;

    let debounceTimer: number | undefined;
    const handleServiceWorkerMessage = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(refreshInbox, SERVICE_WORKER_REFRESH_DEBOUNCE_MS);
    };

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      window.clearTimeout(debounceTimer);
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [authorized, refreshInbox]);

  useEffect(
    () => () => {
      inboxRequestRef.current?.controller.abort();
      detailRequestRef.current?.controller.abort();
    },
    [],
  );

  async function sendReply() {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(selectedId)}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!response.ok) throw new Error("REPLY_FAILED");
      setReply("");
      await Promise.all([loadDetail(), loadInbox()]);
      toast.success("回复已发送");
    } catch {
      toast.error("回复未发送，草稿已经保留。");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(nextStatus: FeedbackStatus) {
    if (!selectedId || !detail || updatingStatus) return;
    const previous = detail.status;
    setDetail({ ...detail, status: nextStatus });
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("STATUS_FAILED");
      await loadInbox();
    } catch {
      setDetail({ ...detail, status: previous });
      toast.error("状态更新失败，已恢复原状态。");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function deleteThread() {
    if (!selectedId || deletingThread) return;
    const confirmed = window.confirm("确认删除这整条反馈对话？这会同时删除所有消息。");
    if (!confirmed) return;

    setDeletingThread(true);
    const deletedId = selectedId;
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(deletedId)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("DELETE_FAILED");

      setDetail(null);
      setSelectedId(null);
      setItems((current) => current.filter((item) => item.id !== deletedId));
      const url = new URL(window.location.href);
      url.searchParams.delete("thread");
      window.history.replaceState(window.history.state, "", url);
      await loadInbox();
      toast.success("对话已删除");
    } catch {
      toast.error("删除失败，请稍后重试。");
    } finally {
      setDeletingThread(false);
    }
  }

  function startEditingMessage(message: Message) {
    setEditingMessageId(message.id);
    setEditingBody(message.body);
  }

  async function saveMessageEdit(message: Message) {
    if (!selectedId || savingMessage || !editingBody.trim()) return;
    setSavingMessage(true);
    try {
      const response = await fetch(
        `/api/admin/feedback/${encodeURIComponent(selectedId)}/messages/${encodeURIComponent(message.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editingBody.trim() }),
        },
      );
      if (!response.ok) throw new Error("MESSAGE_UPDATE_FAILED");

      setDetail((current) => {
        if (!current) return current;
        return {
          ...current,
          messages: current.messages.map((item) =>
            item.id === message.id ? { ...item, body: editingBody.trim() } : item,
          ),
        };
      });
      setEditingMessageId(null);
      setEditingBody("");
      await loadInbox();
      toast.success("消息已更新");
    } catch {
      toast.error("消息修改失败。");
    } finally {
      setSavingMessage(false);
    }
  }

  async function logout() {
    try {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.getRegistration("/admin/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 3000);
          try {
            await fetch("/api/admin/push/subscriptions", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(subscription.toJSON()),
              signal: controller.signal,
            });
          } finally {
            window.clearTimeout(timeout);
            await subscription.unsubscribe();
          }
        }
      }
    } catch {
      // Push cleanup is best-effort. Session deletion must always continue.
    } finally {
      await fetch("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
      router.replace("/admin/login");
      router.refresh();
    }
  }

  if (!authorized) {
    return <div className="min-h-[100dvh] bg-[#f4f4ef]" />;
  }

  const filtersActive = Boolean(sourceApp || channel || query || status !== "needs");

  return (
    <main className="min-h-[100dvh] bg-[#f4f4ef] text-[#1a211e]">
      <div className="grid min-h-[100dvh] lg:grid-cols-[216px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#d9ded8] bg-[#202d28] px-4 py-5 text-[#dce6e0] lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid size-9 place-items-center rounded-lg border border-white/12 bg-white/7">
              <ChatCircleDots size={20} weight="duotone" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white">Researvo</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#90a39a]">Admin console</div>
            </div>
          </div>

          <nav className="mt-10" aria-label="后台导航">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#82968c]">Workspace</div>
            <div className="flex items-center justify-between rounded-lg bg-white/9 px-3 py-2.5 text-sm font-medium text-white">
              <span className="flex items-center gap-2.5">
                <Tray size={18} weight="duotone" />
                反馈收件箱
              </span>
              <span className="rounded bg-[#d8e9e1] px-1.5 py-0.5 font-mono text-[10px] text-[#20483f]">{total}</span>
            </div>
          </nav>

          <div className="mt-auto border-t border-white/10 pt-4">
            <div className="px-3 pb-3 text-xs leading-5 text-[#93a59c]">独立管理会话<br />12 小时后自动过期</div>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#c4d0ca] transition-colors hover:bg-white/7 hover:text-white"
              onClick={logout}
              type="button"
            >
              <SignOut size={17} />
              退出后台
            </button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-[#d9ded8] bg-[#f8f8f4] px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1540px] items-start justify-between gap-5">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#6c7872]">
                  <span className="size-1.5 rounded-full bg-[#bd7e27]" />
                  Feedback operations
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-[28px]">反馈收件箱</h1>
                <p className="mt-1 text-sm text-[#6b756f]">查看新消息、回复用户并维护处理状态。</p>
              </div>
              <div className="flex items-center gap-2">
                <PushNotificationControl />
                <Button aria-label="刷新反馈" onClick={refreshVisibleInbox} size="sm" variant="outline">
                  <ArrowClockwise className={cn(loadingList && "animate-spin")} size={16} />
                  <span className="hidden sm:inline">刷新</span>
                </Button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1540px] px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
            <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-1 overflow-x-auto rounded-lg border border-[#d7ddd7] bg-white p-1">
                {([
                  ["needs", "待回复"],
                  ["open", "待处理"],
                  ["replied", "已回复"],
                  ["resolved", "已解决"],
                  ["ignored", "已忽略"],
                  ["all", "全部"],
                ] as Array<[ViewStatus, string]>).map(([value, label]) => (
                  <button
                    aria-pressed={status === value}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      status === value ? "bg-[#22332c] text-white" : "text-[#68736d] hover:bg-[#eef1ec]",
                    )}
                    key={value}
                    onClick={() => setStatus(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_150px]">
                <label className="relative">
                  <span className="sr-only">搜索反馈</span>
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7b8680]" size={16} />
                  <Input
                    className="h-9 bg-white pl-9"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="消息、应用或安装 ID"
                    value={query}
                  />
                </label>
                <label className="relative">
                  <span className="sr-only">按应用筛选</span>
                  <select
                    className="h-9 w-full appearance-none rounded-lg border border-[#d7ddd7] bg-white px-3 pr-8 text-xs text-[#435049] outline-none focus:border-[#276b62] focus:ring-2 focus:ring-[#276b62]/20"
                    onChange={(event) => setSourceApp(event.target.value)}
                    value={sourceApp}
                  >
                    <option value="">全部应用</option>
                    {sourceOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  <FunnelSimple className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#78837d]" size={14} />
                </label>
                <label className="relative">
                  <span className="sr-only">按渠道筛选</span>
                  <select
                    className="h-9 w-full appearance-none rounded-lg border border-[#d7ddd7] bg-white px-3 pr-8 text-xs text-[#435049] outline-none focus:border-[#276b62] focus:ring-2 focus:ring-[#276b62]/20"
                    onChange={(event) => setChannel(event.target.value)}
                    value={channel}
                  >
                    <option value="">全部渠道</option>
                    {channelOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  <FunnelSimple className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#78837d]" size={14} />
                </label>
              </div>
            </div>

            <div className="grid min-h-[calc(100dvh-226px)] overflow-hidden rounded-xl border border-[#d8ddd8] bg-white shadow-[0_18px_44px_-38px_rgba(21,46,38,.45)] xl:grid-cols-[minmax(390px,0.43fr)_minmax(520px,0.57fr)]">
              <section className={cn("min-w-0 border-r border-[#dfe3de]", mobileDetail && "hidden xl:block")}>
                <div className="flex h-11 items-center justify-between border-b border-[#e1e4df] bg-[#fafaf7] px-5 text-xs text-[#6f7a74]">
                  <span>{loadingList ? "正在同步…" : `${total} 个会话`}</span>
                  {filtersActive ? (
                    <button
                      className="font-medium text-[#276b62] hover:underline"
                      onClick={() => {
                        setStatus("needs");
                        setSourceApp("");
                        setChannel("");
                        setQuery("");
                      }}
                      type="button"
                    >
                      清除筛选
                    </button>
                  ) : null}
                </div>

                {loadingList ? <InboxSkeleton /> : listError ? (
                  <div className="grid min-h-[420px] place-items-center px-8 text-center">
                    <div>
                      <p className="text-sm font-medium text-[#923d37]">{listError}</p>
                      <Button className="mt-4" onClick={() => void loadInbox()} size="sm" variant="outline">重试</Button>
                    </div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="grid min-h-[440px] place-items-center px-8 text-center">
                    <div className="max-w-xs">
                      <div className="mx-auto grid size-12 place-items-center rounded-xl border border-[#dbe1db] bg-[#f1f3ef] text-[#718078]">
                        <Check size={23} weight="duotone" />
                      </div>
                      <h2 className="mt-4 text-sm font-semibold">当前没有需要处理的反馈</h2>
                      <p className="mt-2 text-xs leading-5 text-[#758079]">
                        新消息会在接入 feedback metadata 的应用发送后出现在这里。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[calc(100dvh-270px)] overflow-y-auto">
                    {items.map((item) => (
                      <button
                        aria-current={selectedId === item.id ? "true" : undefined}
                        className={cn(
                          "relative w-full border-b border-[#e3e6e1] px-5 py-4 text-left transition-colors hover:bg-[#f7f8f4]",
                          selectedId === item.id && "bg-[#eef4f0] hover:bg-[#eef4f0]",
                        )}
                        key={item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          setMobileDetail(true);
                          const url = new URL(window.location.href);
                          url.searchParams.set("thread", item.id);
                          window.history.replaceState(window.history.state, "", url);
                        }}
                        type="button"
                      >
                        {selectedId === item.id ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[#276b62]" /> : null}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            {item.needsAdminReply ? (
                              <span className="size-2 shrink-0 rounded-full bg-[#b77723]" aria-label="有新用户消息" />
                            ) : null}
                            <span className="truncate text-xs font-semibold text-[#25312c]">{item.sourceApp}</span>
                            <span className="text-[10px] uppercase tracking-wide text-[#87918b]">{item.channel}</span>
                          </div>
                          <span className="shrink-0 text-[11px] text-[#818b85]">{relativeTime(item.updatedAt)}</span>
                        </div>
                        <p className={cn("mt-2 line-clamp-2 text-sm leading-5", item.needsAdminReply ? "font-medium text-[#202925]" : "text-[#56625c]")}>
                          {item.latestMessage?.body ?? item.message}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate font-mono text-[10px] text-[#87918b]">
                            {item.device || "Unknown device"} · {item.appVersion || item.installId}
                          </div>
                          <StatusBadge className="shrink-0" tone={statusTones[item.status]}>{statusLabels[item.status]}</StatusBadge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className={cn("min-w-0 bg-[#fbfbf8]", !mobileDetail && "hidden xl:block")}>
                {selectedId ? (
                  loadingDetail || !detail ? (
                    <div className="space-y-5 p-7">
                      <Skeleton className="h-7 w-52" />
                      <Skeleton className="h-4 w-80" />
                      <Skeleton className="mt-12 h-24 w-3/4" />
                      <Skeleton className="ml-auto h-20 w-2/3" />
                    </div>
                  ) : (
                    <div className="flex min-h-[calc(100dvh-226px)] flex-col">
                      <div className="border-b border-[#dfe3de] bg-white px-5 py-4 sm:px-7">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <button className="mb-3 inline-flex items-center gap-1 text-xs text-[#64716a] xl:hidden" onClick={() => setMobileDetail(false)} type="button">
                              <ArrowLeft size={14} /> 返回收件箱
                            </button>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold">{detail.sourceApp}</h2>
                              <span className="rounded bg-[#eef1ec] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#65716b]">{detail.channel}</span>
                            </div>
                            <p className="mt-1 truncate font-mono text-[10px] text-[#7d8882]">install / {detail.installId}</p>
                          </div>
                          <label className="shrink-0">
                            <span className="sr-only">处理状态</span>
                            <select
                              className="h-9 rounded-lg border border-[#d7ddd7] bg-white px-3 text-xs font-medium outline-none focus:border-[#276b62] focus:ring-2 focus:ring-[#276b62]/20"
                              disabled={updatingStatus}
                              onChange={(event) => void changeStatus(event.target.value as FeedbackStatus)}
                              value={detail.status}
                            >
                              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </label>
                          <Button
                            aria-label="删除整条反馈对话"
                            disabled={deletingThread}
                            onClick={() => void deleteThread()}
                            size="icon-sm"
                            title="删除对话"
                            variant="danger"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#edf0ec] pt-3 text-[11px] text-[#758079]">
                          <span>设备：{detail.device || "未提供"}</span>
                          <span>版本：{detail.appVersion || "未提供"}</span>
                          <span>创建：{dateTime(detail.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7" aria-live="polite">
                        {detail.messages.map((message) => {
                          const isAdmin = message.senderType === "admin";
                          const isEditing = editingMessageId === message.id;
                          return (
                            <article className={cn("flex", isAdmin ? "justify-end" : "justify-start")} key={message.id}>
                              <div className={cn("max-w-[82%]", isAdmin && "text-right")}>
                                <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-[#7b8680]">
                                  {isAdmin ? null : <span>用户</span>}
                                  <span className={cn(isAdmin && "ml-auto")}>{dateTime(message.createdAt)}</span>
                                  {isAdmin ? <span>管理员</span> : null}
                                </div>
                                <div className={cn(
                                  "rounded-xl px-4 py-3 text-left text-sm leading-6 shadow-[0_8px_22px_-20px_rgba(27,55,45,.6)]",
                                  isAdmin
                                    ? "rounded-tr-sm border border-[#cddfd6] bg-[#e6f0eb] text-[#20372f]"
                                    : "rounded-tl-sm border border-[#dde1dc] bg-white text-[#303a35]",
                                )}>
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        className="min-h-24 resize-y bg-white text-sm"
                                        onChange={(event) => setEditingBody(event.target.value)}
                                        value={editingBody}
                                      />
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          disabled={savingMessage}
                                          onClick={() => {
                                            setEditingMessageId(null);
                                            setEditingBody("");
                                          }}
                                          size="xs"
                                          variant="outline"
                                        >
                                          <X size={13} />
                                          取消
                                        </Button>
                                        <Button
                                          disabled={!editingBody.trim() || savingMessage}
                                          onClick={() => void saveMessageEdit(message)}
                                          size="xs"
                                        >
                                          <FloppyDisk size={13} />
                                          保存
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                                  )}
                                </div>
                                <div className={cn("mt-1.5 flex items-center gap-2 text-[10px] text-[#7b8680]", isAdmin && "justify-end")}>
                                  {!isAdmin ? <span className="break-all normal-case">{formatIpLocation(message)}</span> : null}
                                  {isAdmin && !isEditing ? (
                                    <button
                                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[#4f6258] hover:bg-[#d8e7df]"
                                      onClick={() => startEditingMessage(message)}
                                      type="button"
                                    >
                                      <PencilSimple size={12} />
                                      修改
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <div className="sticky bottom-0 border-t border-[#dce1dc] bg-white p-4 sm:px-7 sm:py-5">
                        <label className="mb-2 block text-xs font-semibold text-[#35423c]" htmlFor="admin-reply">回复用户</label>
                        <div className="rounded-xl border border-[#ccd5cf] bg-[#fbfcfa] p-2 focus-within:border-[#276b62] focus-within:ring-2 focus-within:ring-[#276b62]/15">
                          <Textarea
                            className="min-h-20 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
                            id="admin-reply"
                            onChange={(event) => setReply(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                event.preventDefault();
                                void sendReply();
                              }
                            }}
                            placeholder="输入回复内容…"
                            value={reply}
                          />
                          <div className="flex items-center justify-between gap-3 border-t border-[#e7eae6] px-1 pt-2">
                            <span className="text-[10px] text-[#89938d]">⌘ / Ctrl + Enter 发送</span>
                            <Button disabled={!reply.trim() || sending} onClick={() => void sendReply()} size="sm">
                              <PaperPlaneTilt size={15} weight="fill" />
                              {sending ? "发送中…" : "发送回复"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="grid min-h-[520px] place-items-center text-center">
                    <div>
                      <ChatCircleDots className="mx-auto text-[#8b9891]" size={34} weight="duotone" />
                      <p className="mt-3 text-sm text-[#6f7b74]">从左侧选择一个会话</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
