"use client";

import { ArrowRight, Key, ShieldCheck } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";

type SessionState = {
  authenticated: boolean;
  configured: boolean;
};

export function AdminLogin() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: SessionState) => {
        setSession(value);
        if (value.authenticated) {
          router.replace("/admin/feedback");
        }
      });
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        setError(response.status === 401 ? "访问密钥不正确，请重新检查。" : "暂时无法登录，请稍后重试。");
        return;
      }

      router.replace("/admin/feedback");
      router.refresh();
    } catch {
      setError("无法连接到后台服务，请检查网络后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] bg-[#f3f3ed] lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <section className="relative hidden overflow-hidden border-r border-[#d9ded7] bg-[#1b2823] p-12 text-[#edf3ef] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative">
          <div className="mb-14 inline-flex items-center gap-3 text-sm font-medium tracking-wide text-[#b9c8c0]">
            <span className="grid size-9 place-items-center rounded-lg border border-white/15 bg-white/6">
              <ShieldCheck size={19} weight="duotone" />
            </span>
            Researvo Admin
          </div>
          <p className="max-w-[10ch] text-5xl font-semibold leading-[1.03] tracking-[-0.045em]">
            让每条反馈都有回音。
          </p>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-[#aebdb5]">
            这是独立的反馈维护工作台。查看各个接入应用的新消息、追踪上下文并直接回复用户。
          </p>
        </div>
        <div className="relative grid max-w-xl grid-cols-2 gap-8 border-t border-white/12 pt-7 text-sm">
          <div>
            <div className="font-mono text-2xl text-white">01</div>
            <div className="mt-2 text-[#9baca3]">独立管理会话</div>
          </div>
          <div>
            <div className="font-mono text-2xl text-white">12h</div>
            <div className="mt-2 text-[#9baca3]">会话自动过期</div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#254e45]">
              <ShieldCheck size={20} weight="duotone" />
              Researvo Admin
            </div>
          </div>

          <div className="mb-9">
            <div className="mb-5 grid size-12 place-items-center rounded-xl border border-[#ced9d3] bg-[#e4ede8] text-[#245e53]">
              <Key size={23} weight="duotone" />
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#18201d]">进入反馈后台</h1>
            <p className="mt-3 text-sm leading-6 text-[#68736d]">
              使用服务器中配置的管理访问密钥。此入口不使用 Researvo 普通账号登录。
            </p>
          </div>

          {session && !session.configured ? (
            <div className="rounded-xl border border-[#e2cda9] bg-[#f5ecdd] p-5 text-sm leading-6 text-[#795620]">
              尚未配置后台访问密钥。请先在部署环境中设置
              <code className="mx-1 rounded bg-white/65 px-1.5 py-0.5 font-mono text-xs">FEEDBACK_ADMIN_TOKEN</code>
              ，然后重新启动服务。
            </div>
          ) : (
            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#29342f]" htmlFor="admin-token">
                  管理访问密钥
                </label>
                <Input
                  autoComplete="current-password"
                  autoFocus
                  className="h-11 bg-white px-3"
                  id="admin-token"
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="输入访问密钥"
                  type="password"
                  value={token}
                />
                <p className="text-xs leading-5 text-[#758079]">登录成功后，密钥不会保存在浏览器脚本或地址栏中。</p>
              </div>

              {error ? (
                <p className="rounded-lg border border-[#e7c2bc] bg-[#f8e9e6] px-3 py-2.5 text-sm text-[#9a3838]" role="alert">
                  {error}
                </p>
              ) : null}

              <Button className="h-11 w-full justify-between px-4" disabled={!token || submitting} type="submit">
                <span>{submitting ? "正在验证…" : "进入工作台"}</span>
                <ArrowRight size={17} weight="bold" />
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
