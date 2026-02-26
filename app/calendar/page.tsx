import { TopNav } from "@/components/TopNav";

const events = [
  { day: 3, title: "Cutoff review", tag: "Payroll" },
  { day: 8, title: "Overtime audit", tag: "HR" },
  { day: 14, title: "Upload window", tag: "Admin" },
  { day: 18, title: "Salary compute", tag: "Payroll" },
  { day: 24, title: "Export reports", tag: "Finance" },
];

export default function CalendarPage() {
  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Calendar</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
              Payroll calendar.
            </h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
              Auto sync off
            </span>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">This month</p>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">January</h2>
              </div>
              <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">Preview</span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {Array.from({ length: 30 }).map((_, idx) => {
                const day = idx + 1;
                const highlight = events.find((h) => h.day === day);
                return (
                  <div
                    key={day}
                    className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-sm font-semibold ${
                      highlight
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]/80"
                    }`}
                    aria-label={highlight ? `${highlight.title} on day ${day}` : `Day ${day}`}
                  >
                    <span>{day}</span>
                    {highlight ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        {highlight.tag}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Upcoming</p>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Schedule</h3>
            </div>
            <div className="space-y-3">
              {events.map((item) => (
                <div key={item.day} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div>
                    <p className="text-[var(--foreground)] font-semibold">{item.title}</p>
                    <p>Day {item.day}</p>
                  </div>
                  <span className="rounded-full bg-[var(--accent)]/12 px-3 py-1 text-xs font-semibold text-[var(--accent)]">{item.tag}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
              <p className="text-[var(--foreground)] font-semibold">Next steps</p>
              <p className="mt-1">Wire real calendar data, reminders, and sync with timesheet uploads.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
