import { TopNav } from "@/components/TopNav";

const filters = [
  { label: "Today", active: true },
  { label: "48h", active: false },
  { label: "This week", active: false },
  { label: "Custom", active: false },
];

const logRows = [
  {
    id: "EVT-9124",
    action: "Timesheet uploaded",
    actor: "Admin",
    detail: "Template validated, 4 rows flagged",
    time: "13:04",
    level: "info",
  },
  {
    id: "EVT-9119",
    action: "Salary compute",
    actor: "Payroll",
    detail: "Preview computation executed",
    time: "12:57",
    level: "info",
  },
  {
    id: "EVT-9112",
    action: "Missing logs",
    actor: "Validator",
    detail: "Detected 4 incomplete entries",
    time: "12:10",
    level: "warn",
  },
  {
    id: "EVT-9098",
    action: "Export request",
    actor: "HR",
    detail: "Preview export triggered",
    time: "10:25",
    level: "info",
  },
];

export default function LogsPage() {
  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Logs</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
              Activity feed (preview).
            </h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
              Auto refresh off
            </span>
          </div>
        </header>

        <section className="flex flex-col gap-4 rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-6 shadow-[0_14px_40px_rgba(16,40,94,0.08)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Filters</p>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Audit log</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            {filters.map((filter) => (
              <button
                key={filter.label}
                className={`rounded-full border px-4 py-2 font-semibold transition ${
                  filter.active
                    ? "border-[var(--accent)] bg-white text-[var(--foreground)] shadow-sm"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--accent)]/60 hover:text-[var(--foreground)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-white/80 shadow-[0_12px_38px_rgba(16,40,94,0.06)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 text-sm text-[var(--muted)]">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              Live feed — 4 updates (preview)
            </div>
            <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)]" disabled>
              Export preview
            </button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-white/60 text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                  Event
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                  Actor
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                  Detail
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                  Time
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                  Level
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60 text-[var(--foreground)]">
              {logRows.map((row) => (
                <tr key={row.id} className="bg-[var(--surface)]">
                  <td className="px-5 py-4 font-semibold">{row.action}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{row.actor}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{row.detail}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{row.time}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                        row.level === "warn"
                          ? "bg-amber-500/15 text-amber-200"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {row.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
