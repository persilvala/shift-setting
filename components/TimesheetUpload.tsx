"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedTimesheetRow } from "@/lib/timesheetParser";
import { timesheetRows as employeeMaster } from "@/lib/timesheetData";

type UploadSuccess = {
  ok: true;
  format: "excel" | "pdf";
  rows: ParsedTimesheetRow[];
  warnings: string[];
  sheets?: { name: string; grid: (string | number | Date | undefined)[][] }[];
};

type UploadError = { ok: false; error: string };

export function TimesheetUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [rawSheets, setRawSheets] = useState<{ name: string; grid: (string | number | Date | undefined)[][] }[]>([]);

  const previewRows = useMemo(() => result?.rows ?? [], [result?.rows]);
  const totalRows = result?.rows.length ?? 0;

  const groupedPreview = useMemo(() => {
    const map = new Map<string, ParsedTimesheetRow[]>();
    previewRows.forEach((row) => {
      const key = row.sheetName || "Sheet";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.entries()).map(([sheetName, rows]) => ({
      sheetName,
      rows: rows.sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0)),
    }));
  }, [previewRows]);

  const renderStatTable = (sheetName: string, rows: ParsedTimesheetRow[]) => {
    const fmt = (val: number | null | undefined) => (val === null || val === undefined ? "—" : Number(val).toFixed(2));
    return (
      <div key={sheetName} className="w-full">
        <div className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-[var(--muted)]">
          <span>{sheetName}</span>
          <span>{rows.length} row(s)</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="min-w-[960px] text-sm table-auto">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Work Hrs</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Actual Hrs</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Late</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Early</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Hrs</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Holiday</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Workday</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Trip</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Absence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Leave</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Add Pay</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Deduction</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
            {rows.map((row, idx) => (
              <tr key={`${sheetName}-${row.employeeName}-${row.date}-${row.sourceLine}-${idx}`}>
                <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.employeeName || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.userId || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.dept || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{fmt(row.workHours)}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{fmt(row.workHoursActual)}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.lateCount ?? 0}x ({row.lateMinutes ?? 0}m)</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.earlyCount ?? 0}x ({row.earlyMinutes ?? 0}m)</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.overtimeHours ?? 0}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.overtimeHoliday ?? 0}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.workDays ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.tripDays ?? 0}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.absenceDays ?? 0}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.leaveDays ?? 0}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{((row.addPayNormal ?? 0) + (row.addPayOvertime ?? 0) + (row.addPayAllowance ?? 0)) > 0 ? `$${((row.addPayNormal ?? 0) + (row.addPayOvertime ?? 0) + (row.addPayAllowance ?? 0)).toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{((row.payrollDeduction ?? 0) + (row.leavePayNoPaid ?? 0)) > 0 ? `$${((row.payrollDeduction ?? 0) + (row.leavePayNoPaid ?? 0)).toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.remark || "—"}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderShiftTable = (sheetName: string, rows: ParsedTimesheetRow[]) => {
    const daySet = new Set<string>();
    rows.forEach((row) => {
      if (row.date) {
        const parts = row.date.split("-");
        const day = parts[2] ?? row.date;
        daySet.add(day);
      }
    });
    const dayHeaders = Array.from(daySet).sort((a, b) => Number(a) - Number(b));

    type EmpRow = {
      userId: string;
      name: string;
      dept: string;
      shifts: Record<string, string>;
    };

    const empMap = new Map<string, EmpRow>();
    rows.forEach((row) => {
      const key = `${row.userId ?? ""}|${row.employeeName ?? ""}|${row.dept ?? ""}`;
      if (!empMap.has(key)) {
        empMap.set(key, {
          userId: row.userId ?? "",
          name: row.employeeName ?? "",
          dept: row.dept ?? "",
          shifts: {},
        });
      }
      const entry = empMap.get(key)!;
      if (row.date) {
        const parts = row.date.split("-");
        const day = parts[2] ?? row.date;
        const code = (row.raw && row.raw[0]) || row.timeIn || row.timeOut || "";
        entry.shifts[day] = code;
      }
    });

    const empRows = Array.from(empMap.values());

    return (
      <div key={sheetName} className="w-full">
        <div className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-[var(--muted)]">
          <span>{sheetName}</span>
          <span>{empRows.length} employee(s)</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="min-w-max text-sm table-auto">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Department</th>
                {dayHeaders.map((day) => (
                  <th key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.24em]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
              {empRows.map((emp, idx) => (
                <tr key={`${emp.userId}-${emp.name}-${idx}`}>
                  <td className="px-4 py-3 text-[var(--muted)]">{emp.userId || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{emp.name || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{emp.dept || "—"}</td>
                  {dayHeaders.map((day) => (
                    <td key={day} className="px-2 py-2 text-center text-[var(--muted)]">
                      {emp.shifts[day] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAttendanceTable = (sheetName: string, rows: ParsedTimesheetRow[]) => {
    const fmt = (val: number | null | undefined) => (val === null || val === undefined ? "—" : Number(val).toFixed(2));
    const validRows = rows.filter((row) => row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
    return (
      <div key={sheetName} className="w-full">
        <div className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-[var(--muted)]">
          <span>{sheetName}</span>
          <span>{validRows.length} row(s)</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="min-w-[760px] text-sm table-auto">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Time In</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Time Out</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Late</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Early</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
            {validRows.map((row, idx) => (
              <tr key={`${sheetName}-${row.employeeName}-${row.date}-${row.sourceLine}-${idx}`}>
                <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.employeeName || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.date || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.timeIn || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.timeOut || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{fmt(row.totalHours)}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.lateCount ?? 0}x ({row.lateMinutes ?? 0}m)</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.earlyCount ?? 0}x ({row.earlyMinutes ?? 0}m)</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.userId || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.dept || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.remark || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  const renderSheetGroup = (group: { sheetName: string; rows: ParsedTimesheetRow[] }) => {
    const isShiftTable = group.rows.some((r) => r.template === "shift-code-table");
    const hasStatFields = group.rows.some((r) => r.workHours !== undefined || r.workHoursActual !== undefined || r.overtimeHoliday !== undefined);
    if (isShiftTable) return renderShiftTable(group.sheetName, group.rows);
    if (hasStatFields) return renderStatTable(group.sheetName, group.rows);
    return renderAttendanceTable(group.sheetName, group.rows);
  };

  const renderRawSheets = () => {
    if (!rawSheets.length) return null;
    return (
      <div className="space-y-4">
        {rawSheets.map((sheet) => {
          const rows = sheet.grid.slice(0, 60);
          return (
            <div key={`raw-${sheet.name}`} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
                <span>{sheet.name}</span>
                <span>{rows.length} row(s) shown</span>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="min-w-[640px] text-sm table-auto">
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={`r-${rIdx}`} className={rIdx % 2 === 0 ? "bg-white" : "bg-[var(--surface)]/50"}>
                        {row.map((cell, cIdx) => (
                          <td key={`c-${cIdx}`} className="px-2 py-1 text-[var(--muted)] whitespace-nowrap">
                            {cell === undefined || cell === null || cell === "" ? "" : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleGeneratePayroll = () => {
    if (!result?.rows.length) {
      setError("Please upload a timesheet first");
      return;
    }
    sessionStorage.setItem("timesheetData", JSON.stringify(result.rows));
    router.push("/payroll");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a timesheet file first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/timesheets/upload", {
        method: "POST",
        body,
      });

      const data = (await response.json()) as UploadSuccess | UploadError;

      if (!response.ok || !data.ok) {
        const message = "error" in data ? data.error : "Failed to parse file";
        setError(message);
        return;
      }

      const normalizedMaster = employeeMaster.map((emp) => ({
        ...emp,
        key: emp.name.trim().toLowerCase(),
      }));

      const unmatchedNames = new Set<string>();

      const dedup = new Set<string>();

      const mappedRows = data.rows
        .map((row) => {
          const key = (row.employeeName ?? "").trim().toLowerCase();
          const match = normalizedMaster.find((emp) => emp.key === key);
          if (!match) {
            if (key) unmatchedNames.add(row.employeeName ?? "");
            return row;
          }
          return {
            ...row,
            userId: row.userId ?? match.id,
            dept: row.dept ?? match.dept,
          } satisfies ParsedTimesheetRow;
        })
        .filter((row) => {
          const k = [row.sheetName ?? "", row.template ?? "", row.employeeName ?? "", row.date ?? "", row.timeIn ?? "", row.timeOut ?? "", row.totalHours ?? ""].join("|#|");
          if (dedup.has(k)) return false;
          dedup.add(k);
          return true;
        });

      setUnmatched([...unmatchedNames]);
      setResult({ ...data, rows: mappedRows });
      setRawSheets(data.sheets ?? []);
      sessionStorage.setItem("timesheetData", JSON.stringify(mappedRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Timesheets</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            Intake pipeline for Excel, CSV, and PDF uploads.
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGeneratePayroll}
              disabled={!result?.rows.length}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate Payroll →
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Upload</p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Drop a timesheet file</h2>
            <p className="text-sm text-[var(--muted)]">
              Accepts Excel (.xlsx, .xls), CSV, or PDF. We normalize to Name, Date, Time In, Time Out, Total Hours.
            </p>
          </div>
          <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            Parser ready
          </span>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/90 px-5 py-5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--foreground)]">Choose a file</p>
                <p>Supported headers: Name, Date, Time In, Time Out, Hours (any casing/spacing).</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--muted)]">
                {file ? file.name : "Browse"}
              </div>
            </div>
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">
              Required: Name, Date
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">
              Optional: Time In, Time Out, Hours
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">
              Auto-computes hours if in/out exist
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-80"
            >
              {submitting ? "Parsing…" : "Upload and parse"}
            </button>
            {error ? <span className="text-sm font-semibold text-red-600">{error}</span> : null}
            {!error && submitting ? <span className="text-sm text-[var(--muted)]">Working on it…</span> : null}
          </div>
        </form>
      </section>

      {result && result.rows.length > 0 && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Parse result</p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">Preview</h3>
              <p className="text-sm text-[var(--muted)]">First 48 rows shown; download/export will use full data.</p>
              {unmatched.length > 0 && (
                <p className="text-sm font-semibold text-amber-700">Unmatched names: {unmatched.join(", ")}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold text-[var(--muted)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">
                Rows: {totalRows}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">
                Format: {result.format.toUpperCase()}
              </span>
            </div>
          </div>

          {result?.warnings.length ? (
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-amber-700">
              {result.warnings.map((warning) => (
                <span key={warning} className="rounded-full bg-amber-100 px-3 py-1">
                  {warning}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-5 space-y-6">
            {groupedPreview.map((group) => renderSheetGroup(group))}
          </div>
        </section>
      )}

      {!result && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
            <p className="text-base font-semibold text-[var(--foreground)]">No file processed yet</p>
            <p className="mt-1">Upload an Excel, CSV, or PDF timesheet to see the normalized preview here.</p>
          </div>
        </section>
      )}
    </main>
  );
}
