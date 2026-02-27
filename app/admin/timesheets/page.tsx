const payrollSummary = [
  { title: "Total employees", value: "84", meta: "across 6 departments" },
  { title: "Hours in period", value: "6,420", meta: "cutoff: Jan 1 – 15" },
  { title: "Projected payroll", value: "$182,940", meta: "including OT" },
];

const validations = [
  { title: "Template format", detail: "Excel/PDF layout matches standard fields", status: "Ready" },
  { title: "Required fields", detail: "Employee ID, date, time-in, time-out present", status: "Ready" },
  { title: "Duplicate detection", detail: "No repeated IDs + timestamps", status: "Queued" },
  { title: "Missing logs", detail: "4 rows flagged for review", status: "Review" },
];

const attendance = [
  {
    id: "EMP-0142",
    name: "Monique Rivas",
    dept: "Engineering",
    calendar: "07:00 - 15:00 (Mon-Fri)",
    hours: "82h",
    overtime: "6h",
    late: "12m",
    undertime: "0",
    status: "Clean",
    week: { Mo: 1, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 0, Su: 0 },
  },
  {
    id: "EMP-0178",
    name: "Kai Mendoza",
    dept: "Operations",
    calendar: "09:00 - 17:00 (Mon-Fri)",
    hours: "76h",
    overtime: "0",
    late: "28m",
    undertime: "40m",
    status: "Attention",
    week: { Mo: 1, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 0, Su: 0 },
  },
  {
    id: "EMP-0204",
    name: "Priya Shah",
    dept: "Support",
    calendar: "11:00 - 19:00 (Tue-Sat)",
    hours: "88h",
    overtime: "10h",
    late: "0",
    undertime: "0",
    status: "Clean",
    week: { Mo: 0, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 1, Su: 0 },
  },
];

const flow = [
  {
    title: "Upload timesheet",
    detail: "Admin/HR submits the existing template (Excel or PDF).",
  },
  {
    title: "Validation",
    detail: "Format, required columns, duplicates, and missing time logs are checked.",
  },
  {
    title: "Dashboard view",
    detail: "Attendance data becomes visible with filters by employee, department, and cutoff.",
  },
  {
    title: "Salary computation",
    detail: "Regular hours, overtime, deductions, and net pay are calculated automatically.",
  },
  {
    title: "Reporting",
    detail: "Payroll summaries and individual breakdowns are ready for export (Excel/PDF).",
  },
];

export default function TimesheetsPage() {
  return (
    <div className="space-y-8">
      <header className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)]/70 bg-gradient-to-br from-[#f8fbff] via-[#eef3ff] to-[#e4edff] p-6 shadow-[0_18px_60px_rgba(16,40,94,0.08)]">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(47,109,246,0.16)]" />
            Timesheet Upload & Salary Computation
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-[var(--foreground)]">
            Configure the flow before wiring the logic.
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Preview of the upcoming experience: upload the existing template, validate logs, surface attendance in the dashboard, and compute payroll with overtime rules.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 font-semibold text-[var(--foreground)] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Role-based: Admin, HR, Employee
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 font-semibold text-[var(--foreground)] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              Upload Excel or PDF
            </span>
          </div>
        </div>

        <div className="grid gap-3 rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(16,40,94,0.08)] sm:grid-cols-3 sm:p-6">
          {payrollSummary.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-inner">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">{item.title}</p>
              <p className="pt-2 text-2xl font-semibold text-[var(--foreground)]">{item.value}</p>
              <p className="text-sm text-[var(--muted)]">{item.meta}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Upload & validation</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Template readiness</h2>
            </div>
            <button
              type="button"
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              disabled
            >
              Preview mode
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-center text-sm text-[var(--muted)]">
            <p className="text-base font-semibold text-[var(--foreground)]">Drop timesheet file</p>
            <p>Accepted: Excel (.xlsx) or PDF template</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              Validation will run automatically (preview mode)
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {validations.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)] shadow-[0_10px_28px_rgba(16,40,94,0.06)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[var(--foreground)] font-semibold">{item.title}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                      item.status === "Ready"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "Review"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-[var(--accent)]/12 text-[var(--accent)]"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Payroll readiness</p>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Cutoff snapshot</h3>
            <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <div>
                  <p className="text-[var(--foreground)] font-semibold">Cutoff period</p>
                  <p>Jan 1 – Jan 15</p>
                </div>
                <span className="rounded-full bg-[var(--accent)]/12 px-3 py-1 text-[var(--accent)] text-xs font-semibold">In review</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <div>
                  <p className="text-[var(--foreground)] font-semibold">Rules to apply</p>
                  <p>Standard daily hours, overtime rate, break time deductions</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                <div>
                  <p className="text-[var(--foreground)] font-semibold">Exports</p>
                  <p>Payroll summary & individual breakdown (Excel/PDF)</p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <a
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                    href="/api/export/timesheets/excel"
                  >
                    Export Excel
                  </a>
                  <a
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                    href="/api/export/timesheets/pdf"
                  >
                    Export PDF
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)]/70 bg-gradient-to-br from-[#10253f] via-[#0f2036] to-[#0b192b] p-5 text-white shadow-[0_20px_60px_rgba(16,40,94,0.14)]">
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">System checks</p>
            <h3 className="text-lg font-semibold">Authentication & access</h3>
            <div className="mt-4 space-y-3 text-sm text-white/80">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div>
                  <p className="text-white font-semibold">Secure login</p>
                  <p>Email + password with session management</p>
                </div>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100">Enabled</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div>
                  <p className="text-white font-semibold">Roles</p>
                  <p>Admin, HR, Employee with scoped dashboards</p>
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">Configured</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div>
                  <p className="text-white font-semibold">Password reset</p>
                  <p>Placeholder flow — wiring pending</p>
                </div>
                <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100">Planned</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Attendance snapshot</p>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Cutoff detail</h3>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <a
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                href="/api/export/timesheets/excel"
              >
                Export Excel
              </a>
              <a
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                href="/api/export/timesheets/pdf"
              >
                Export PDF
              </a>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Dept</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Calendar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Mo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Tu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">We</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Th</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Fr</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Sa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Su</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white text-[var(--foreground)]">
              {attendance.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface)]/60">
                  <td className="px-4 py-4 font-semibold">{row.name}</td>
                  <td className="px-4 py-4 text-[var(--muted)]">{row.dept}</td>
                  <td className="px-4 py-4 text-[var(--muted)]">{row.calendar}</td>
                  <td className="px-4 py-4">{row.week.Mo}</td>
                  <td className="px-4 py-4">{row.week.Tu}</td>
                  <td className="px-4 py-4">{row.week.We}</td>
                  <td className="px-4 py-4">{row.week.Th}</td>
                  <td className="px-4 py-4">{row.week.Fr}</td>
                  <td className="px-4 py-4">{row.week.Sa}</td>
                  <td className="px-4 py-4">{row.week.Su}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
                        row.status === "Clean"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-5 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">System flow</p>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">End-to-end steps</h3>
          </div>
          <div className="space-y-3">
            {flow.map((item, index) => (
              <div key={item.title} className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
                <div className="absolute left-[-10px] top-4 h-5 w-5 rounded-full bg-[var(--panel)] shadow-[0_0_0_1px_var(--border)]" />
                <div className="flex items-center justify-between">
                  <p className="text-[var(--foreground)] font-semibold">{item.title}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Step {index + 1}</span>
                </div>
                <p className="mt-1 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
            <p className="text-[var(--foreground)] font-semibold">Reporting targets</p>
            <p className="mt-1">Individual attendance summary, payroll summary report, and attendance analytics will export to Excel/PDF.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
