"use client";

import { useEffect, useState } from "react";
import Link from "next/link";   // Link is how you make a clickable page-to-page link in next.js
import { useRouter } from "next/navigation";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, Page, PageHeader, Panel, td, th } from "@/components/ui";
import { formatCost, fullTime, timeAgo } from "@/lib/format";

// the shape of one row from GET /runs (matches the agent_runs table)
type Run = {
  run_id: string;
  user_message: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  claude_calls: number;
  created_at: string;
};

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + "/runs")
      .then((res) => res.json())
      .then((data) => setRuns(data))
      .catch(() => setError("Could not load runs. Is the backend running?"))
      .finally(() => setLoaded(true));
  }, []);

  // search happens in the browser. 50 rows is small enough that no extra endpoint is needed
  const shown = runs.filter((r) => r.user_message.toLowerCase().includes(query.trim().toLowerCase()));
  const totalCost = runs.reduce((sum, r) => sum + Number(r.cost_usd), 0);

  return (
    <Page>
      <PageHeader
        title="Runs"
        subtitle={
          loaded && runs.length > 0
            ? "One row per request. " + runs.length + " most recent, " + formatCost(totalCost) + " total."
            : "One row per request you sent the agent."
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel
        flush
        title={
          <span className="relative block">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search requests"
              className="w-64 max-w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-9 pr-3 text-sm font-normal outline-none placeholder:text-faint focus:border-accent"
            />
          </span>
        }
        action={<span className="text-xs text-faint">{shown.length} shown</span>}
      >
        {!loaded ? (
          <div className="px-5 pb-5 text-sm text-muted">Loading...</div>
        ) : shown.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title={runs.length === 0 ? "No runs yet" : "No runs match that search"}>
              {runs.length === 0 && (
                <Link href="/agent" className="text-accent hover:underline">Run the agent</Link>
              )}
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-line bg-surface-2">
                <tr>
                  <th className={th}>Request</th>
                  <th className={th + " text-right"}>Claude calls</th>
                  <th className={th + " text-right"}>Tokens in / out</th>
                  <th className={th + " text-right"}>Cost</th>
                  <th className={th}>When</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((run) => (
                  // clicking anywhere on the row opens /runs/<this run's id>, the trace page
                  <tr
                    key={run.run_id}
                    onClick={() => router.push("/runs/" + run.run_id)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className={td + " max-w-md"}>
                      <div className="truncate font-medium">{run.user_message}</div>
                      <div className="font-mono text-[11px] text-faint">{run.run_id.slice(0, 8)}</div>
                    </td>
                    <td className={td + " text-right tabular-nums"}>{run.claude_calls}</td>
                    <td className={td + " text-right tabular-nums text-muted whitespace-nowrap"}>
                      {run.input_tokens.toLocaleString()} / {run.output_tokens.toLocaleString()}
                    </td>
                    <td className={td + " text-right tabular-nums"}>{formatCost(run.cost_usd)}</td>
                    <td className={td + " text-muted whitespace-nowrap"} title={fullTime(run.created_at)}>
                      {timeAgo(run.created_at)}
                    </td>
                    <td className={td + " text-right"}>
                      <Link
                        href={"/runs/" + run.run_id}
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
