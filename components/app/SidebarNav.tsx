"use client";

import { FlaskConical, LayoutDashboard, LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const primaryNavItems = [
  { href: "/workspace", icon: LayoutDashboard, label: "Workspace" },
  { href: "/surveys/new/wizard", icon: FlaskConical, label: "New survey" },
];

const accountNavItems = [
  { href: "/profile", icon: UserRound, label: "Profile" },
  { href: "/settings", icon: Settings2, label: "Settings" },
];

const navLinkClass =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--hs-muted)] transition-all duration-200 hover:bg-[var(--hs-primary-soft)] hover:text-[var(--hs-primary-deep)] active:translate-y-px";

export function SidebarNav({ orientation = "vertical" }: { orientation?: "horizontal" | "vertical" }) {
  const pathname = usePathname();
  const renderNavItem = (item: (typeof primaryNavItems | typeof accountNavItems)[number]) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;

    return (
      <Link
        className={cn(
          navLinkClass,
          orientation === "horizontal" && "shrink-0",
          isActive && "bg-[var(--hs-primary-soft)] text-[var(--hs-primary-deep)] shadow-[inset_0_0_0_1px_rgba(39,107,98,0.12)]",
        )}
        href={item.href}
        key={item.href}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
        {item.label}
      </Link>
    );
  };

  const logoutButton = (
    <button
      className={cn(navLinkClass, "w-full", orientation === "horizontal" && "w-auto shrink-0")}
      onClick={() => signOut({ callbackUrl: "/" })}
      type="button"
    >
      <LogOut aria-hidden="true" className="size-4" strokeWidth={1.8} />
      Log out
    </button>
  );

  if (orientation === "horizontal") {
    return (
      <nav aria-label="Publisher navigation" className="flex gap-2 overflow-x-auto pb-1">
        {[...primaryNavItems, ...accountNavItems].map(renderNavItem)}
        {logoutButton}
      </nav>
    );
  }

  return (
    <nav aria-label="Publisher navigation" className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">{primaryNavItems.map(renderNavItem)}</div>
      <div className="mt-6 flex flex-col gap-1 border-t border-[var(--hs-border)] pt-4">
        {accountNavItems.map(renderNavItem)}
        {logoutButton}
      </div>
    </nav>
  );
}
