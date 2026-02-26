import { TopNav } from "@/components/TopNav";

const cards = [
  {
    title: "Incoming payouts",
    value: "$12,480",
    meta: "Clearing in 2 days",
  },
  {
    title: "On hold",
    value: "$2,140",
    meta: "Verification required",
  },
  {
    title: "Average settlement",
    value: "1.8 days",
    meta: "Across last 30 days",
  },
];

const scheduled = [
  { name: "Quarterly billing", time: "Today, 3:00 PM", status: "Scheduled" },
  { name: "Vendor batch", time: "Tomorrow, 10:00 AM", status: "Queued" },
  { name: "Payroll run", time: "Fri, 9:30 AM", status: "On time" },
];

const calendarHighlights = [
  { day: "12", label: "Payout", tone: "accent" },
  { day: "14", label: "Review", tone: "muted" },
  { day: "18", label: "Close", tone: "muted" },
  { day: "22", label: "ACH", tone: "accent" },
];

export default function Home() {
  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Payments</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
              Keep payouts, summaries, and schedule in one view.
            </h1>
            <button className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[rgba(47,109,246,0.25)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              New payment
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-5 shadow-[0_20px_60px_rgba(16,40,94,0.08)] transition hover:-translate-y-0.5"
            >
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">{card.title}</p>
              <p className="pt-3 text-3xl font-semibold text-[var(--foreground)]">{card.value}</p>
              <p className="text-sm text-[var(--muted)]">{card.meta}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Activity</p>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Upcoming items</h2>
              </div>
              <button className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                View all
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {scheduled.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-[var(--foreground)]">{item.name}</p>
                    <p>{item.time}</p>
                  </div>
                  <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Calendar</p>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">This month</h2>
              </div>
              <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">Auto sync</span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {Array.from({ length: 30 }).map((_, idx) => {
                const day = idx + 1;
                const highlight = calendarHighlights.find((h) => h.day === String(day));
                return (
                  <div
                    key={day}
                    className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-sm font-semibold ${
                      highlight
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]/80"
                    }`}
                    aria-label={highlight ? `${highlight.label} on day ${day}` : `Day ${day}`}
                  >
                    <span>{day}</span>
                    {highlight ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        {highlight.label}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
