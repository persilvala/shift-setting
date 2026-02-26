import { TopNav } from "@/components/TopNav";

const summaryCards = [
  { title: "Total employees", value: "84", meta: "across 6 departments" },
  { title: "Total hours", value: "6,420h", meta: "Cutoff: Jan 1 – 15" },
  { title: "Projected payroll", value: "$182,940", meta: "includes overtime" },
];

const overtime = [
  { label: "Engineering", hours: "210h", rate: "x1.5" },
  { label: "Operations", hours: "180h", rate: "x1.25" },
  { label: "Support", hours: "230h", rate: "x1.5" },
];

const reportItems = [
  {
    title: "Individual attendance",
    detail: "Per-employee summary with hours, late, undertime, overtime.",
    status: "Preview",
  },
  {
    title: "Payroll summary",
    detail: "Cutoff totals and projected cost ready for export.",
    status: "Preview",
  },
  {
    title: "Attendance analytics",
    detail: "Trends by department and date range.",
    status: "Planned",
  },
];

export default function SummaryPage() {
  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Summary</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
              Payroll and attendance overview.
            </h1>
            <button className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--muted)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              Export preview
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/85 p-5 shadow-[0_20px_60px_rgba(16,40,94,0.08)]"
            >
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">{card.title}</p>
              <p className="pt-3 text-3xl font-semibold text-[var(--foreground)]">{card.value}</p>
              <p className="text-sm text-[var(--muted)]">{card.meta}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Cutoff detail</p>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Jan 1 – Jan 15</h2>
              </div>
              <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Preview
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)] shadow-[0_10px_28px_rgba(16,40,94,0.06)]">
                <p className="text-[var(--foreground)] font-semibold">Hours breakdown</p>
                <p>Total working hours, late minutes, undertime, overtime</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)] shadow-[0_10px_28px_rgba(16,40,94,0.06)]">
                <p className="text-[var(--foreground)] font-semibold">Salary computation</p>
                <p>Hourly rate or fixed salary, overtime rate, deductions</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-5 text-sm text-[var(--muted)]">
              <p className="text-base font-semibold text-[var(--foreground)]">Net working hours formula</p>
              <p>Net Working Hours = Total Hours – Break Time</p>
              <p className="pt-2">Overtime Hours = Hours Worked – Standard Daily Hours</p>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Overtime summary</p>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Department view</h3>
            </div>
            <div className="space-y-3">
              {overtime.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>
                    <p className="text-[var(--foreground)] font-semibold">{item.label}</p>
                    <p>Rate {item.rate}</p>
                  </div>
                  <span className="rounded-full bg-[var(--accent)]/12 px-3 py-1 text-xs font-semibold text-[var(--accent)]">{item.hours}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
              <p className="text-[var(--foreground)] font-semibold">Exports</p>
              <p className="mt-1">Excel/PDF export planned after computation wiring.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Reports</p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">Planned outputs</h3>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Preview</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {reportItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)] shadow-[0_10px_28px_rgba(16,40,94,0.06)]">
                <div className="flex items-center justify-between">
                  <p className="text-[var(--foreground)] font-semibold">{item.title}</p>
                  <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
