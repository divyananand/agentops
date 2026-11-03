"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, PlayIcon, ShieldIcon, XIcon } from "@/components/icons";
import { ErrorBanner, JsonBlock, LiveBadge, Page, PageHeader, Panel, StatusPill } from "@/components/ui";
import { formatMs, timeAgo } from "@/lib/format";

const API = process.env.NEXT_PUBLIC_API_URL;

type Approval = {
  id: number;
  run_id: string;
  tool_name: string;
  tool_input: object;
  created_at: string;
};

// what GET /runs/<id> returns once the run is saved
type Finished = {
  steps: { id: number; tool_name: string; status: string; latency_ms: number }[];
};

// one click fills the box, so nobody has to think of a first request
const EXAMPLES = [
  "Find the blockers in the docs and create a task for each one",
  "Create a task called 'key test' with low priority",
  "Give me a summary report of the tasks",
  "When is the team lunch?",
];

const MAX_CHARS = 300;

// the demo key lives in sessionStorage (this browser tab only). reading it through
// useSyncExternalStore means the server render and the first browser render agree
const KEY_EVENT = "demo-key-changed";
function subscribeKey(onChange: () => void) {
  window.addEventListener(KEY_EVENT, onChange);
  return () => window.removeEventListener(KEY_EVENT, onChange);
}
function readKey() {
  try {
    return sessionStorage.getItem("demoKey") ?? "";
  } catch {
    return "";
  }
}
function saveKey(value: string) {
  try {
    sessionStorage.setItem("demoKey", value);
  } catch {
    // storage blocked: the key just won't survive a refresh
  }
  window.dispatchEvent(new Event(KEY_EVENT));
}

export default function AgentPage() {
  const demoKey = useSyncExternalStore(subscribeKey, readKey, () => "");
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [pending, setPending] = useState<Approval[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  // ids of tickets already answered, so a slow poll can't bring a card back
  const handled = useRef<Set<number>>(new Set());

  // true while a run has started but hasn't finished
  const working = runId !== null && finished === null;

  // ask for pending approvals of THIS run every 2 seconds
  useEffect(() => {
    if (!runId) return;

    function check() {
      fetch(API + "/approvals/pending?run_id=" + runId, { headers: { "X-Demo-Key": demoKey } })
        // a wrong key returns an error object, not a list, so treat it as "nothing pending"
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Approval[]) => setPending(data.filter((a) => !handled.current.has(a.id))))
        .catch(() => {});
    }

    check();
    const timer = setInterval(check, 2000);
    return () => clearInterval(timer);
  }, [runId, demoKey]);

  // once a run has started, ask whether it has finished (404 means not yet)
  useEffect(() => {
    if (!runId) return;
    let tries = 0;

    const timer = setInterval(() => {
      tries = tries + 1;
      fetch(API + "/runs/" + runId)
        .then((res) => (res.status === 404 ? null : res.json()))
        .then((data) => {
          if (data) {
            setFinished(data);
            setPending([]);
            clearInterval(timer);
          }
        })
        .catch(() => {});
      // give up after about 4 minutes
      if (tries >= 120) clearInterval(timer);
    }, 2000);

    return () => clearInterval(timer);
  }, [runId]);

  function startRun() {
    if (working || starting) return;
    if (message.trim() === "") return;
    setError("");
    setPending([]);
    setFinished(null);
    setStarting(true);
    handled.current = new Set();

    fetch(API + "/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Demo-Key": demoKey },
      body: JSON.stringify({ message: message }),
    })
      .then((res) => {
        if (res.status === 401) throw new Error("Wrong or missing demo key.");
        if (res.status === 429) throw new Error("Today's demo budget is used up. Try again tomorrow.");
        if (res.status === 400) throw new Error("Message is too long (300 characters max).");
        if (!res.ok) throw new Error("Could not start the run.");
        return res.json();
      })
      .then((data) => setRunId(data.run_id))
      .catch((e) =>
        setError(e instanceof TypeError ? "Could not reach the backend. Is it running?" : e.message)
      )
      .finally(() => setStarting(false));
  }

  function decide(id: number, decision: string) {
    handled.current.add(id);
    // remove the card straight away. the ref stops the next poll from bringing it back
    setPending((old) => old.filter((a) => a.id !== id));
    fetch(API + "/approvals/" + id + "/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Demo-Key": demoKey },
      body: JSON.stringify({ decision: decision, run_id: runId }),
    })
      .then((res) => {
        if (res.status === 401) setError("Wrong or missing demo key, so your answer wasn't saved.");
        if (res.status === 409) setError("Ticket #" + id + " was already decided or expired.");
      })
      .catch(() => setError("Could not send your answer."));
  }

  return (
    <Page>
      <PageHeader
        title="Run the agent"
        subtitle="Live runs need a demo key. The dashboard, runs and logs pages are open to everyone."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel className="mb-6">
        <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="demo-key">
          Demo key
        </label>
        <input
          id="demo-key"
          type="password"
          autoComplete="off"
          className="w-full sm:w-80 rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25 mb-5"
          placeholder="Paste the key you were given"
          value={demoKey}
          onChange={(e) => saveKey(e.target.value)}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <input
              className="w-full rounded-lg border border-line bg-surface-2 px-4 py-2.5 pr-16 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
              placeholder="e.g. Find the blockers and create a task for each one"
              value={message}
              maxLength={MAX_CHARS}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startRun(); }}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-faint">
              {message.length}/{MAX_CHARS}
            </span>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
            onClick={startRun}
            disabled={working || starting || message.trim() === ""}
          >
            <PlayIcon className="w-3.5 h-3.5" />
            {starting ? "Starting..." : working ? "Running..." : "Run"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setMessage(ex)}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>

        {working && (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm">
            <span className="live-dot" />
            Agent is working. It will ask below if it needs your approval.
          </div>
        )}

        {finished && (
          <div className="mt-5 rounded-lg border border-line bg-surface-2 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CheckIcon className="w-4 h-4 text-ok" /> Run finished
            </div>
            {finished.steps.length === 0 ? (
              <p className="text-sm text-muted">The agent answered without using any tools.</p>
            ) : (
              <ol className="flex flex-col gap-2 mb-3">
                {finished.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right text-xs tabular-nums text-faint">{i + 1}</span>
                    <span className="font-mono text-xs">{s.tool_name}</span>
                    <StatusPill status={s.status} />
                    <span className="ml-auto text-xs tabular-nums text-muted">{formatMs(s.latency_ms)}</span>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href={"/runs/" + runId}
              className="mt-1 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Open full trace <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <ShieldIcon className="w-4 h-4 text-warn" />
            Waiting for your approval
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted tabular-nums">
              {pending.length}
            </span>
          </span>
        }
        action={working ? <LiveBadge label="Checking every 2s" /> : undefined}
      >
        {pending.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing waiting. The agent asks here before it creates or updates a task.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* one card per ticket. only this run's tickets ever show up here */}
            {pending.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)",
                  background: "color-mix(in srgb, var(--warn) 6%, transparent)",
                }}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    The agent wants to run <span className="font-mono font-semibold">{a.tool_name}</span>
                  </div>
                  <span className="text-xs text-faint">
                    #{a.id} · asked {timeAgo(a.created_at)}
                  </span>
                </div>
                <JsonBlock value={a.tool_input} />
                <div className="mt-3 flex gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    style={{ background: "#16a34a" }}
                    onClick={() => decide(a.id, "approved")}
                  >
                    <CheckIcon className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-err hover:text-err"
                    onClick={() => decide(a.id, "rejected")}
                  >
                    <XIcon className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
