"use client";

import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import type { ParsedTimesheetRow } from "@/lib/timesheetParser";

type FilterState = {
  employee: string;
  dept: string;
  startDate: string;
  endDate: string;
};

const initialFilters: FilterState = {
  employee: "all",
  dept: "all",
  startDate: "",
  endDate: "",
};

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getHours(row: ParsedTimesheetRow) {
  return (
    row.workHoursActual ??
    row.workHours ??
    row.totalHours ??
    0
  );
}

export default function DashboardPage() {
  const [rows, setRows] = useState<ParsedTimesheetRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  useEffect(() => {
    const stored = sessionStorage.getItem("timesheetData");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ParsedTimesheetRow[];
      setRows(parsed);
    } catch {
      setRows([]);
    }
  }, []);

  const employees = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.employeeName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const departments = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.dept || "").filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const start = asDate(filters.startDate || null);
    const end = asDate(filters.endDate || null);

    return rows.filter((row) => {
      if (filters.employee !== "all" && row.employeeName !== filters.employee) return false;
      if (filters.dept !== "all" && (row.dept || "") !== filters.dept) return false;

      if (start || end) {
        if (!row.date) return false;
        const d = asDate(row.date);
        if (!d) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
      }
      return true;
    });
  }, [filters, rows]);

  const aggregates = useMemo(() => {
    const byEmployee = new Map<
      string,
      {
        dept: string;
        dates: Set<string>;
        hours: number;
        overtime: number;
        lateMinutes: number;
        earlyMinutes: number;
        absenceDays: number;
        leaveDays: number;
      }
    >();

    let totalHours = 0;
    let totalOvertime = 0;
    let totalLate = 0;
    let totalEarly = 0;

    filteredRows.forEach((row) => {
      const key = row.employeeName || "Unknown";
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          dept: row.dept || "",
          dates: new Set<string>(),
          hours: 0,
          overtime: 0,
          lateMinutes: 0,
          earlyMinutes: 0,
          absenceDays: 0,
          leaveDays: 0,
        });
      }

      const entry = byEmployee.get(key)!;
      if (row.date) entry.dates.add(row.date);
      entry.hours += getHours(row) || 0;
      entry.overtime += row.overtimeHours ?? 0;
      entry.lateMinutes += row.lateMinutes ?? 0;
      entry.earlyMinutes += row.earlyMinutes ?? 0;
      entry.absenceDays += row.absenceDays ?? 0;
      entry.leaveDays += row.leaveDays ?? 0;

      totalHours += getHours(row) || 0;
      totalOvertime += row.overtimeHours ?? 0;
      totalLate += row.lateMinutes ?? 0;
      totalEarly += row.earlyMinutes ?? 0;
    });

    const attendance = Array.from(byEmployee.entries())
      .map(([name, data]) => ({
        employeeName: name,
        dept: data.dept,
        presentDays: data.dates.size,
        absenceDays: data.absenceDays,
        leaveDays: data.leaveDays,
        hours: Math.round(data.hours * 100) / 100,
        overtime: Math.round(data.overtime * 100) / 100,
        lateMinutes: data.lateMinutes,
        earlyMinutes: data.earlyMinutes,
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    return {
      totalHours,
      totalOvertime,
      totalLate,
      totalEarly,
      employees: byEmployee.size,
      attendance,
    };
  }, [filteredRows]);

  const hasData = rows.length > 0;

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
            Dashboard
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
                Timesheet-backed attendance and payroll snapshot.
              </h1>
              <p className="max-w-3xl text-sm text-[var(--muted)]">
                View totals from the latest uploaded timesheet, apply filters, and jump to upload or payroll when you need to refresh or compute.
              </p>
              <p className="text-xs text-[var(--muted)]">Loaded rows: {rows.length || 0} {rows.length ? "(from session)" : "— upload to populate"}</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Filters</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Slice by employee, department, and date range</h2>
            </div>
            <button
              type="button"
              onClick={() => setFilters(initialFilters)}
              className="self-start rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Reset filters
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Employee</label>
              <select
                value={filters.employee}
                onChange={(e) => setFilters((f) => ({ ...f, employee: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="all">All employees</option>
                {employees.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Department</label>
              <select
                value={filters.dept}
                onChange={(e) => setFilters((f) => ({ ...f, dept: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="all">All departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Start date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">End date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/85 p-5 shadow-[0_20px_60px_rgba(16,40,94,0.08)]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Total hours</p>
            <p className="pt-3 text-3xl font-semibold text-[var(--foreground)]">{aggregates.totalHours.toFixed(2)}</p>
            <p className="text-sm text-[var(--muted)]">Filtered sum of hours</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/85 p-5 shadow-[0_20px_60px_rgba(16,40,94,0.08)]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Overtime hours</p>
            <p className="pt-3 text-3xl font-semibold text-[var(--foreground)]">{aggregates.totalOvertime.toFixed(2)}</p>
            <p className="text-sm text-[var(--muted)]">Across filtered rows</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/85 p-5 shadow-[0_20px_60px_rgba(16,40,94,0.08)]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Late minutes</p>
            <p className="pt-3 text-3xl font-semibold text-[var(--foreground)]">{aggregates.totalLate}</p>
            <p className="text-sm text-[var(--muted)]">Sum of late minutes</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/85 p-5 shadow-[0_20px_60px_rgba(16,40,94,0.08)]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Undertime (early) minutes</p>
            <p className="pt-3 text-3xl font-semibold text-[var(--foreground)]">{aggregates.totalEarly}</p>
            <p className="text-sm text-[var(--muted)]">Sum of early/undertime minutes</p>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Attendance summary</p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">Per employee (filtered)</h3>
              <p className="text-sm text-[var(--muted)]">Present days are unique dates in the parsed timesheet. Leave/absence use provided fields when available.</p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">Employees: {aggregates.employees}</span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Present</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Leave</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Absent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Late (min)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Undertime (min)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {!hasData || aggregates.attendance.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 text-center text-[var(--muted)]">
                        {hasData ? "No rows match the current filters." : "Upload a timesheet to populate the dashboard."}
                      </td>
                    </tr>
                  ) : (
                    aggregates.attendance.map((entry) => (
                      <tr key={entry.employeeName} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{entry.employeeName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.dept || "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.presentDays}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.leaveDays}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.absenceDays}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.hours.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.overtime.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.lateMinutes}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.earlyMinutes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
