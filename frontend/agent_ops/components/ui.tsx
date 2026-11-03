// the shared building blocks. pages are made out of these, so they all look alike

// which colour each status gets. one place, instead of a statusColor() copy on every page
const STATUS_VAR: Record<string, string> = {
  success: "var(--ok)",
  approved: "var(--info)",
  error: "var(--err)",
  blocked: "var(--warn)",
  pending: "var(--warn)",
  rejected: "var(--reject)",
  expired: "var(--idle)",
};

export function StatusPill({ status }: { status: string }) {
  const color = STATUS_VAR[status] ?? "var(--idle)";
  return (
    <span className="pill" style={{ ["--pill" as string]: color }}>
      {status}
    </span>
  );
}

export function statusVar(status: string) {
  return STATUS_VAR[status] ?? "var(--idle)";
}

// the title row at the top of every page. actions sit on the right (buttons, live dot)
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

// the content area of a page. keeps the width and side spacing the same everywhere
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 py-8">{children}</div>;
}

// a bordered box with an optional title row
export function Panel({
  title,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean; // flush = no inner padding, for tables that run edge to edge
}) {
  return (
    <section className={"rounded-xl border border-line bg-surface " + className}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? "" : "px-5 pb-5 " + (title ? "" : "pt-5")}>{children}</div>
    </section>
  );
}

// one big number with a label above and a small note below
export function StatCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  accent?: string; // a status colour for the thin bar on the left
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-4">
      {accent && (
        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: accent }} />
      )}
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums truncate">{value}</div>
      {note && <div className="mt-1 text-xs text-faint truncate">{note}</div>}
    </div>
  );
}

// shown instead of an empty table, so the page explains itself
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="text-sm text-muted mt-1">{children}</div>}
    </div>
  );
}

// tool inputs and outputs are objects, so show them as pretty json.
// capped height so one long search result doesn't push every other step off the screen
export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-6 rounded-lg border px-4 py-3 text-sm"
      style={{
        color: "var(--err)",
        borderColor: "color-mix(in srgb, var(--err) 35%, transparent)",
        background: "color-mix(in srgb, var(--err) 8%, transparent)",
      }}
    >
      {children}
    </div>
  );
}

// "● Live" badge for pages that refresh by themselves
export function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
      <span className="live-dot" />
      {label}
    </span>
  );
}

// table cell styles, shared so every table lines up the same way
export const th = "px-5 py-2.5 text-left text-xs font-medium text-muted whitespace-nowrap";
export const td = "px-5 py-3 align-middle";
