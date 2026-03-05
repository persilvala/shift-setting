"use client";

import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import type { ParsedTimesheetRow, DashboardRow, FilterState } from "@/lib/types";

const initialFilters: FilterState = {
  employee: "",
  dept: "all",
  startDate: "",
  endDate: "",
};

type TimesheetWithRows = {
  id: string;
  fileName: string;
  format: string;
  startDate: string;
  endDate: string;
  totalRows: number;
  uploadedAt: string;
  rows: DashboardRow[];
};

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getHours(row: ParsedTimesheetRow | TimesheetWithRows["rows"][0]) {
  return (
    (row as ParsedTimesheetRow).workHoursActual ??
    (row as ParsedTimesheetRow).workHours ??
    (row as TimesheetWithRows["rows"][0]).workHoursActual ??
    (row as TimesheetWithRows["rows"][0]).workHours ??
    row.totalHours ??
    0
  );
}

function formatDateRange(dates: Set<string>) {
  const unique = Array.from(dates).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
  if (!unique.length) return "—";
  unique.sort((a, b) => a.getTime() - b.getTime());
  const start = unique[0];
  const end = unique[unique.length - 1];
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return unique.length === 1 ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export default function DashboardPage() {
  const [rows, setRows] = useState<ParsedTimesheetRow[]>([]);
  const [dbRows, setDbRows] = useState<DashboardRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"database" | "session">("session");
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/timesheets");
      const data = await response.json();

      if (data.timesheets && data.timesheets.length > 0) {
        const allTimesheets = await Promise.all(
          data.timesheets.map(async (ts: { id: string }) => {
            const detailResponse = await fetch(`/api/timesheets/${ts.id}`);
            const detailData = await detailResponse.json();
            return detailData.timesheet;
          })
        );

        const combinedRows = allTimesheets.flatMap((ts: { rows: DashboardRow[] }) => ts.rows);
        setDbRows(combinedRows);
        setDataSource("database");
        console.log('[Dashboard] Refreshed', combinedRows.length, 'total rows from all timesheets');
      }
    } catch (err) {
      console.error('[Dashboard] Failed to refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch ALL timesheets from database and combine rows
    const fetchFromDatabase = async () => {
      try {
        console.log('[Dashboard] Fetching all timesheets from database...');
        const response = await fetch("/api/timesheets");
        const data = await response.json();
        console.log('[Dashboard] Timesheets API response:', data);

        if (data.timesheets && data.timesheets.length > 0) {
          console.log('[Dashboard] Found', data.timesheets.length, 'timesheets');

          // Fetch all timesheets and combine their rows
          const allTimesheets = await Promise.all(
            data.timesheets.map(async (ts: { id: string }) => {
              const detailResponse = await fetch(`/api/timesheets/${ts.id}`);
              const detailData = await detailResponse.json();
              return detailData.timesheet;
            })
          );

          // Combine all rows from all timesheets
          const combinedRows = allTimesheets.flatMap((ts: { rows: DashboardRow[] }) => ts.rows);
          console.log('[Dashboard] Combined', combinedRows.length, 'total rows from all timesheets');

          setDbRows(combinedRows);
          setDataSource("database");
          console.log('[Dashboard] dataSource set to: database');
        } else {
          console.log('[Dashboard] No timesheets found in database');
        }
      } catch (err) {
        console.error('[Dashboard] Failed to fetch from database:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFromDatabase();

    // Listen for timesheet updates
    const handleTimesheetUpdated = () => {
      console.log('[Dashboard] Timesheet updated, refreshing...');
      fetchFromDatabase();
    };

    window.addEventListener('timesheet-updated', handleTimesheetUpdated);

    // Also check session storage for compatibility
    const stored = sessionStorage.getItem("timesheetData");
    console.log('[Dashboard] SessionStorage data:', stored ? JSON.parse(stored).length : 0, 'rows');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ParsedTimesheetRow[];
      setRows(parsed);
    } catch {
      setRows([]);
    }

    return () => {
      window.removeEventListener('timesheet-updated', handleTimesheetUpdated);
    };
  }, []);

  const activeRows: DashboardRow[] = dbRows.length > 0 ? dbRows : (rows as DashboardRow[]);

  const employees = useMemo(() => {
    return Array.from(new Set(activeRows.map((r) => r.employeeName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activeRows]);

  const departments = useMemo(() => {
    return Array.from(new Set(activeRows.map((r) => r.dept || "").filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activeRows]);

  const filteredRows = useMemo(() => {
    const start = asDate(filters.startDate || null);
    const end = asDate(filters.endDate || null);

    return activeRows.filter((row) => {
      if (filters.employee && !(row.employeeName || "").toLowerCase().includes(filters.employee.toLowerCase())) return false;
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
  }, [filters, activeRows]);

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
        dateLabel: formatDateRange(data.dates),
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

  const hasData = activeRows.length > 0;

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
                View totals from all uploaded timesheets, apply filters, and jump to upload or payroll when you need to refresh or compute.
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--muted)]">
                  Loaded rows: {activeRows.length || 0} {activeRows.length ? dataSource === "database" ? "(from database)" : "(from session)" : "— upload to populate"}
                </span>
                {dataSource === "database" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    DB
                  </span>
                )}
                {refreshing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    Refreshing...
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
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
              <input
                type="search"
                value={filters.employee}
                onChange={(e) => setFilters((f) => ({ ...f, employee: e.target.value }))}
                list="employee-suggestions"
                placeholder="Search employee"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
              <datalist id="employee-suggestions">
                {employees.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Dates</th>
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
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.dateLabel}</td>
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
