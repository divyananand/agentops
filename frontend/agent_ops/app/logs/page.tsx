"use client";
// needed because we use useState and useEffect, same as StartupOS

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, JsonBlock, Page, PageHeader, Panel, StatusPill, td, th } from "@/components/ui";
import { formatMs, fullTime, timeAgo } from "@/lib/format";

// the shape of one row from GET /logs (matches the agent_logs table)
type Log = {
  id: number;
  run_id: string;
  tool_name: string;
  input: object;
  output: object | string;
  status: string;
  latency_ms: number;
  created_at: string;
};

const FILTERS = ["all", "success", "error", "rejected", "blocked", "expired"];

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  // which row is opened up to show its full input and output
  const [openId, setOpenId] = useState<number | null>(null);

  // runs once when the page opens, asks the backend for the rows
  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + "/logs")
      .then((res) => res.json())
      .then((data) => setLogs(data))
      .catch(() => setError("Could not load logs. Is the backend running?"))
      .finally(() => setLoaded(true));
  }, []);

  const countOf = (status: string) =>
    status === "all" ? logs.length : logs.filter((l) => l.status === status).length;

  const q = query.trim().toLowerCase();
  const shown = logs.filter(
    (l) =>
      (filter === "all" || l.status === filter) &&
      (q === "" || l.tool_name.toLowerCase().includes(q) || JSON.stringify(l.input).toLowerCase().includes(q))
  );

  return (
    <Page>
      <PageHeader title="Logs" subtitle="Every tool call the agent made, newest first. Click a row to see the full input and output." />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* filters in one row: status chips on the left, search on the right */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f === "all" || countOf(f) > 0).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors " +
                (filter === f
                  ? "border-accent bg-accent-soft text-accent font-medium"
                  : "border-line text-muted hover:text-fg")
              }
            >
              {f} <span className="tabular-nums opacity-70">{countOf(f)}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tool or input"
            className="w-60 rounded-lg border border-line bg-surface py-1.5 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
        </div>
      </div>

      <Panel flush>
        {!loaded ? (
          <div className="p-5 text-sm text-muted">Loading...</div>
        ) : shown.length === 0 ? (
          <div className="p-5">
            <EmptyState title={logs.length === 0 ? "No tool calls yet" : "Nothing matches these filters"} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className={th}>Tool</th>
                  <th className={th}>Input</th>
                  <th className={th}>Status</th>
                  <th className={th + " text-right"}>Latency</th>
                  <th className={th}>When</th>
                </tr>
              </thead>
              <tbody>
                {/* one row per log. key is how react tracks each row */}
                {shown.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => setOpenId(openId === log.id ? null : log.id)}
                      className={
                        "cursor-pointer border-b border-line hover:bg-surface-2 " +
                        (openId === log.id ? "bg-surface-2" : "")
                      }
                    >
                      <td className={td + " font-mono text-xs whitespace-nowrap"}>{log.tool_name}</td>
                      {/* input is an object, react can't show objects, so turn it into text */}
                      <td className={td + " max-w-sm truncate font-mono text-xs text-muted"}>
                        {JSON.stringify(log.input)}
                      </td>
                      <td className={td}>
                        <StatusPill status={log.status} />
                      </td>
                      <td className={td + " text-right tabular-nums text-muted"}>{formatMs(log.latency_ms)}</td>
                      <td className={td + " text-muted whitespace-nowrap"} title={fullTime(log.created_at)}>
                        {timeAgo(log.created_at)}
                      </td>
                    </tr>

                    {openId === log.id && (
                      <tr className="border-b border-line bg-surface-2">
                        <td colSpan={5} className="px-5 pb-5 pt-1">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <div className="text-xs text-muted mb-1.5">Input</div>
                              <JsonBlock value={log.input} />
                            </div>
                            <div>
                              <div className="text-xs text-muted mb-1.5">Output</div>
                              <JsonBlock value={log.output} />
                            </div>
                          </div>
                          <Link
                            href={"/runs/" + log.run_id}
                            className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            Open the full run trace <ArrowRightIcon className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
