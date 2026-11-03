"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, LogoIcon, LogsIcon, PlayIcon, RunsIcon } from "./icons";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/agent", label: "Run agent", Icon: PlayIcon },
  { href: "/runs", label: "Runs", Icon: RunsIcon },
  { href: "/logs", label: "Logs", Icon: LogsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  // startsWith so /runs/<id> still lights up "Runs"
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* desktop: fixed column on the left */}
      <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-8">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <LogoIcon className="w-4 h-4" />
          </span>
          <span className="font-semibold tracking-tight">AgentOps</span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " +
                (isActive(href)
                  ? "bg-accent-soft text-accent font-medium"
                  : "text-muted hover:bg-surface-2 hover:text-fg")
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-1">
          <div className="text-[11px] text-faint mb-2 px-1">Theme</div>
          <ThemeToggle />
        </div>
      </aside>

      {/* phone: a bar across the top with the same links */}
      <header className="md:hidden sticky top-0 z-10 border-b border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <LogoIcon className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold">AgentOps</span>
          </Link>
          <div className="w-32">
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm " +
                (isActive(href) ? "bg-accent-soft text-accent font-medium" : "text-muted")
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
