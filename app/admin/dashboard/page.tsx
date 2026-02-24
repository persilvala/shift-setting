"use client";

import { useState } from "react";

const summary = [
  { title: "Active shifts", value: "42", change: "+6 today", tone: "accent" },
  { title: "Pending approvals", value: "14", change: "3 urgent", tone: "amber" },
];

const schedule = [
  {
    userId: "1",
    name: "Percy",
    department: "CICS",
    calendar: "07:00 - 15:00",
    weekShift: "Mon - Fri",
  },
  {
    userId: "2",
    name: "Dan",
    department: "CICS",
    calendar: "09:00 - 17:00",
    weekShift: "Mon - Fri",
  },
  {
    userId: "3",
    name: "Lanz",
    department: "CICS",
    calendar: "11:00 - 19:00",
    weekShift: "Tue - Sat",
  },
  {
    userId: "4",
    name: "Joshaiah",
    department: "CICS",
    calendar: "13:00 - 21:00",
    weekShift: "Wed - Sun",
  },
];

type ScheduleRow = (typeof schedule)[number];

export default function DashboardPage() {
  const [selected, setSelected] = useState<ScheduleRow | null>(null);
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const monthDays = (() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = Array(firstDay).fill(null).concat(
      Array.from({ length: totalDays }, (_, i) => i + 1)
    );
    while (days.length % 7 !== 0) days.push(null);
    return { year, month, days };
  })();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <div
            key={item.title}
            className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] px-6 py-6 shadow-[0_14px_40px_rgba(16,40,94,0.08)]"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              {item.title}
            </p>
            <div className="flex items-end justify-between pt-3">
              <p className="text-4xl font-semibold text-[var(--foreground)]">{item.value}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.tone === "green"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.tone === "accent"
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {item.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Today</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Coverage overview</h2>
            </div>
            <button className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]">
              Export snapshot
            </button>
          </div>
          <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-white/80 shadow-[0_12px_38px_rgba(16,40,94,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-white text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-[0.24em]">User ID</th>
                  <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-[0.24em]">Name</th>
                  <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-[0.24em]">Department</th>
                  <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-[0.24em]">Calendar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/70 bg-[#f7faff] text-[var(--foreground)]">
                {schedule.map((row) => (
                  <tr key={row.userId}>
                    <td className="px-5 py-4 font-semibold">{row.userId}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{row.name}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{row.department}</td>
                    <td className="px-5 py-4">
                      <span className="mr-2 inline-flex items-center rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        {row.weekShift}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        aria-label={`Open calendar for ${row.name}`}
                        onClick={() => setSelected((prev) => (prev?.userId === row.userId ? null : row))}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="4" y="5" width="16" height="15" rx="3" />
                          <path d="M8 3v4M16 3v4M4 10h16" />
                          <path d="M10 14h4" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="mt-4 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)] p-4 shadow-[0_10px_28px_rgba(16,40,94,0.06)]">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Schedule</p>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{selected.name}</h3>
                  <p className="text-sm text-[var(--muted)]">Dept: {selected.department}</p>
                  <p className="text-sm text-[var(--muted)]">Week shift: {selected.weekShift}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] bg-[linear-gradient(160deg,#0b3018,#0f3c1f)] p-3 text-sm text-white shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.24em] text-white/70">Today</span>
                    <span className="text-lg font-semibold">{formattedDate}</span>
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                    {selected.calendar}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <span key={d} className="py-1 text-white/70">
                      {d}
                    </span>
                  ))}
                  {monthDays.days.map((day, idx) => {
                    const isToday = day === today.getDate();
                    return (
                      <span
                        key={`${day ?? "blank"}-${idx}`}
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          day === null
                            ? "text-transparent"
                            : isToday
                              ? "bg-emerald-400 text-black font-semibold"
                              : "bg-white/5 text-white"
                        }`}
                      >
                        {day ?? ""}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>Duration</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l3 3" />
                    </svg>
                    30 mins
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
