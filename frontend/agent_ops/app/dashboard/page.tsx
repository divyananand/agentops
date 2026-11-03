"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, PlayIcon } from "@/components/icons";
import {
  EmptyState,
  ErrorBanner,
  LiveBadge,
  Page,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  statusVar,
  td,
  th,
} from "@/components/ui";
import { formatCost, formatMs, fullTime, timeAgo } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL;

// the shape of what GET /stats returns
type StatusCount = { status: string; calls: number };
type ToolCount = { tool_name: string; calls: number };
type Recent = {
  id: number;
  run_id: string;
  tool_name: string;
  status: string;
  latency_ms: number;
  created_at: string;
};
type Stats = {
  status_counts: StatusCount[];
  avg_latency_ms: number;
  tool_counts: ToolCount[];
  retried_calls: number;
  total_runs: number;
  total_cost: number;
  recent: Recent[];
};

// the order outcomes appear in the bar and legend: good first, then the ones that didn't run
const OUTCOME_ORDER = ["success", "error", "rejected", "blocked", "expired"];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  // ask the backend for fresh numbers now, then again every 5 seconds
  useEffect(() => {
    function load() {
      fetch(API + "/stats")
        .then((res) => res.json())
        .then((data) => {
          setStats(data);
          setError("");
        })
        .catch(() => setError("Could not load stats. Is the backend running?"));
    }

    load();
    const timer = setInterval(load, 5000);
    // stop asking when you leave the page
    return () => clearInterval(timer);
  }, []);

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle="Everything your agent did, refreshed every 5 seconds."
      actions={
        <>
          <LiveBadge />
          <Link
            href="/agent"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            <PlayIcon className="w-3.5 h-3.5" />
            Run agent
          </Link>
        </>
      }
    />
  );

  if (!stats) {
    return (
      <Page>
        {header}
        {error ? (
          <ErrorBanner>{error}</ErrorBanner>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[98px] rounded-xl border border-line bg-surface animate-pulse" />
            ))}
          </div>
        )}
      </Page>
    );
  }

  // how many tool calls ended with this status. 0 if none did
  const count = (status: string) => {
    const row = stats.status_counts.find((s) => s.status === status);
    return row ? Number(row.calls) : 0;
  };

  const total = stats.status_counts.reduce((sum, s) => sum + Number(s.calls), 0);
  const success = count("success");
  const failed = count("error");
  // calls that never ran: the guard blocked them, or a human said no / didn't answer
  const declined = count("blocked") + count("rejected") + count("expired");
  // success rate only counts calls that actually ran
  const ran = success + failed;
  const successRate = ran > 0 ? Math.round((success / ran) * 100) : 0;

  const mostUsed = stats.tool_counts.length > 0 ? stats.tool_counts[0] : null;
  const topCalls = mostUsed ? Number(mostUsed.calls) : 1;

  // only the outcomes that actually happened, in a fixed order so colours never jump around
  const outcomes = OUTCOME_ORDER.map((s) => ({ status: s, calls: count(s) })).filter((o) => o.calls > 0);

  return (
    <Page>
      {header}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total tool calls" value={total} note={"across " + stats.total_runs + " runs"} />
        <StatCard
          label="Success rate"
          value={successRate + "%"}
          note={success + " of " + ran + " calls that ran"}
          accent="var(--ok)"
        />
        <StatCard label="Failed" value={failed} note="crashed after retries" accent="var(--err)" />
        <StatCard label="Not run" value={declined} note="blocked, rejected or expired" accent="var(--reject)" />
        <StatCard label="Average latency" value={formatMs(Math.round(Number(stats.avg_latency_ms)))} note="calls that ran" />
        <StatCard
          label="Most used tool"
          value={<span className="font-mono text-xl">{mostUsed ? mostUsed.tool_name : "none yet"}</span>}
          note={mostUsed ? mostUsed.calls + " calls" : ""}
        />
        <StatCard label="Total cost" value={formatCost(stats.total_cost)} note="Claude API spend" />
        <StatCard label="Retried calls" value={stats.retried_calls} note="needed more than one try" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Panel title="Outcomes" action={<span className="text-xs text-faint">{total} calls</span>}>
          {total === 0 ? (
            <p className="text-sm text-muted">No tool calls yet.</p>
          ) : (
            <>
              {/* one bar split into outcomes. the gap between pieces keeps neighbours apart */}
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
                {outcomes.map((o) => (
                  <div
                    key={o.status}
                    title={o.status + ": " + o.calls + " (" + Math.round((o.calls / total) * 100) + "%)"}
                    style={{ width: (o.calls / total) * 100 + "%", background: statusVar(o.status) }}
                  />
                ))}
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
                {outcomes.map((o) => (
                  <li key={o.status} className="flex items-center justify-between text-sm">
                    <StatusPill status={o.status} />
                    <span className="tabular-nums">
                      {o.calls}
                      <span className="text-faint ml-1.5 text-xs">{Math.round((o.calls / total) * 100)}%</span>
                    </span>
                  </li>
                ))}
              </ul>
              {/* the one idea the colours can't say on their own */}
              <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                <span className="font-medium text-fg">Rejected, blocked and expired</span>{" "}calls never ran. A
                safety check or a human stopped them, so they don&apos;t count against the success rate.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Tool usage" action={<span className="text-xs text-faint">calls per tool</span>}>
          {stats.tool_counts.length === 0 ? (
            <p className="text-sm text-muted">No tool calls yet.</p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {stats.tool_counts.map((t) => (
                <li key={t.tool_name} className="text-sm" title={t.tool_name + ": " + t.calls + " calls"}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs">{t.tool_name}</span>
                    <span className="tabular-nums text-muted">{t.calls}</span>
                  </div>
                  {/* the bar is as wide as this tool's calls compared to the busiest tool */}
                  <div className="h-2 w-full rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: (Number(t.calls) / topCalls) * 100 + "%" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent executions"
        action={
          <Link href="/logs" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            All logs <ArrowRightIcon className="w-3 h-3" />
          </Link>
        }
        flush
      >
        {stats.recent.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title="Nothing has run yet">Start a run and it will show up here.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-line bg-surface-2">
                <tr>
                  <th className={th}>Tool</th>
                  <th className={th}>Status</th>
                  <th className={th + " text-right"}>Latency</th>
                  <th className={th}>When</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r) => (
                  // the whole row opens the trace, not just a tiny link
                  <tr
                    key={r.id}
                    onClick={() => router.push("/runs/" + r.run_id)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className={td + " font-mono text-xs"}>{r.tool_name}</td>
                    <td className={td}>
                      <StatusPill status={r.status} />
                    </td>
                    <td className={td + " text-right tabular-nums text-muted"}>{formatMs(r.latency_ms)}</td>
                    <td className={td + " text-muted whitespace-nowrap"} title={fullTime(r.created_at)}>
                      {timeAgo(r.created_at)}
                    </td>
                    <td className={td + " text-right"}>
                      <Link
                        href={"/runs/" + r.run_id}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        Trace <ArrowRightIcon className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
