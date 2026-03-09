"use client";

import type { AttendanceSummary } from "@/lib/attendanceCalculator";

type Props = {
  rows: AttendanceSummary[];
  loading?: boolean;
};

export function AttendanceSummaryTable({ rows, loading }: Props) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Attendance summary</p>
          <h3 className="text-xl font-semibold text-[var(--foreground)]">Processed from the uploaded file</h3>
          <p className="text-sm text-[var(--muted)]">Present/leave/absent counts and worked hours per employee.</p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">
          {loading ? "Processing…" : `${rows.length} employee${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Dept</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Present dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Present</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Leave</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Absent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Late (Min)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Under (Min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-4 text-center text-[var(--muted)]">
                    {loading ? "Processing file…" : "Upload a file to see attendance summary."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.employeeName}-${row.userId ?? ""}`} className="hover:bg-[var(--surface)]/60">
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.employeeName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.dept ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.presentDates}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.present}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.leave}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.absent}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.overtimeHours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.lateMinutes}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.underMinutes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
