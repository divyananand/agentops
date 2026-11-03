"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ShieldIcon } from "@/components/icons";
import { EmptyState, JsonBlock, Page, Panel, StatCard, StatusPill, statusVar } from "@/components/ui";
import { formatCost, formatMs, fullTime } from "@/lib/format";

type Step = {
  id: number;
  tool_name: string;
  input: object;
  output: object | string;
  status: string;
  latency_ms: number;
  attempts: number;   // day 8: how many tries the tool call took
  created_at: string;
};

type Run = {
  run_id: string;
  user_message: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  claude_calls: number;
  created_at: string;
};

// day 9: one approval ticket. decided_at is empty while it's still waiting
type Approval = {
  id: number;
  tool_name: string;
  tool_input: object;
  status: string;
  created_at: string;
  decided_at: string | null;
};

// how long the human took to answer, in seconds. returns null if there's no answer yet
function waitSeconds(a: Approval) {
  if (!a.decided_at) return null;
  const ms = new Date(a.decided_at).getTime() - new Date(a.created_at).getTime();
  return (ms / 1000).toFixed(1);
}

function BackLink() {
  return (
    <Link href="/runs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <ArrowLeftIcon className="w-4 h-4" /> Back to runs
    </Link>
  );
}

export default function TracePage() {
  const params = useParams();
  const runId = params.run_id as string;

  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + "/runs/" + runId)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setRun(data.run);
          setSteps(data.steps);
          // "|| []" so older responses without approvals don't crash the page
          setApprovals(data.approvals || []);
        }
      })
      .catch((err) => console.error("could not load trace:", err));
  }, [runId]);

  if (notFound) {
    return (
      <Page>
        <BackLink />
        <div className="mt-6">
          <EmptyState title="Run not found">
            If you just started it, the trace appears once the run finishes. Try again in a few seconds.
          </EmptyState>
        </div>
      </Page>
    );
  }
  if (!run) {
    return (
      <Page>
        <BackLink />
        <div className="mt-6 h-40 rounded-xl border border-line bg-surface animate-pulse" />
      </Page>
    );
  }

  const toolTime = steps.reduce((sum, s) => sum + s.latency_ms, 0);

  // total time humans spent deciding. skips tickets that have no answer yet
  let humanTime = 0;
  for (let i = 0; i < approvals.length; i++) {
    const w = waitSeconds(approvals[i]);
    if (w !== null) humanTime = humanTime + Number(w);
  }

  return (
    <Page>
      <BackLink />

      <div className="mt-4 mb-6">
        <div className="text-xs font-medium text-muted mb-1">Run trace</div>
        <h1 className="text-2xl font-semibold tracking-tight">&ldquo;{run.user_message}&rdquo;</h1>
        <div className="mt-1.5 text-sm text-faint">
          <span className="font-mono">{run.run_id.slice(0, 8)}</span> · {fullTime(run.created_at)}
        </div>
      </div>

      {/* summary cards. one of them: time spent waiting for a human */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Cost" value={formatCost(run.cost_usd)} />
        <StatCard label="Claude calls" value={run.claude_calls} />
        <StatCard
          label="Tokens in / out"
          value={<span className="text-xl">{run.input_tokens.toLocaleString()} / {run.output_tokens.toLocaleString()}</span>}
        />
        <StatCard label="Time in tools" value={(toolTime / 1000).toFixed(1) + "s"} />
        <StatCard label="Waiting for human" value={humanTime.toFixed(1) + "s"} />
      </div>

      {/* approvals section. only shown if this run asked for any approvals */}
      {approvals.length > 0 && (
        <Panel
          className="mb-6"
          title={
            <span className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4 text-warn" /> Approvals ({approvals.length})
            </span>
          }
        >
          <ul className="flex flex-col divide-y divide-line">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="font-mono text-xs">{a.tool_name}</span>
                <StatusPill status={a.status} />
                {/* "after 5.3s" for answered tickets, "still waiting" if there's no answer yet */}
                <span className="text-muted ml-auto text-xs">
                  {waitSeconds(a) !== null ? "answered after " + waitSeconds(a) + "s" : "still waiting"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={"Steps (" + steps.length + ")"}>
        {steps.length === 0 ? (
          <p className="text-sm text-muted">The agent answered without using any tools.</p>
        ) : (
          <ol className="relative ml-3 border-l border-line">
            {steps.map((step, i) => (
              <li key={step.id} className="relative pl-8 pb-8 last:pb-0">
                {/* the numbered dot takes the colour of the step's status */}
                <span
                  className="absolute -left-3.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-surface text-xs font-semibold tabular-nums"
                  style={{ borderColor: statusVar(step.status), color: statusVar(step.status) }}
                >
                  {i + 1}
                </span>

                <div className="flex flex-wrap items-center gap-2.5 mb-3 pt-0.5">
                  <span className="font-mono text-sm font-semibold">{step.tool_name}</span>
                  <StatusPill status={step.status} />
                  <span className="text-xs text-muted tabular-nums">{formatMs(step.latency_ms)}</span>

                  {/* day 8 badge: only shows when the tool needed more than one try */}
                  {step.attempts > 1 && (
                    <span className="pill" style={{ ["--pill" as string]: "var(--warn)" }}>
                      retried {step.attempts - 1}x
                    </span>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted mb-1.5">Input</div>
                    <JsonBlock value={step.input} />
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1.5">Output</div>
                    <JsonBlock value={step.output} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </Page>
  );
}
