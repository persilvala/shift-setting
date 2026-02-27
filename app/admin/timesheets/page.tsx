"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { useRouter } from "next/navigation";
import type { ParsedTimesheetRow } from "@/lib/timesheetParser";

type UploadSuccess = {
  ok: true;
  format: "excel" | "pdf";
  rows: ParsedTimesheetRow[];
  warnings: string[];
};

type UploadError = { ok: false; error: string };

export default function TimesheetUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previewRows = useMemo(() => result?.rows.slice(0, 8) ?? [], [result]);
  const totalRows = result?.rows.length ?? 0;

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

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Timesheets</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
              Intake pipeline for Excel and PDF uploads.
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
              <p className="text-sm text-[var(--muted)]">Accepts Excel (.xlsx, .xls) or PDF. We normalize to Name, Date, Time In, Time Out, Total Hours.</p>
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
                accept=".xlsx,.xls,.pdf"
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
                <p className="text-sm text-[var(--muted)]">First 8 rows shown; download/export will use full data.</p>
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

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">User ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Work Hrs</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Hrs</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Late</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Early</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Work Days</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Add Pay</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Deductions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {previewRows.map((row, idx) => (
                    <tr key={`${row.employeeName}-${row.date}-${row.sourceLine}-${idx}`} className="hover:bg-[var(--surface)]/60">
                      <td className="px-4 py-3 text-[var(--muted)]">{row.userId || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.employeeName || "—"}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.dept || "—"}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.totalHours?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.overtimeHours?.toFixed(2) ?? "0.00"}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.lateCount ?? 0}x ({row.lateMinutes ?? 0}m)</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.earlyCount ?? 0}x ({row.earlyMinutes ?? 0}m)</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.workDays ?? "—"}</td>
                      <td className="px-4 py-3 text-emerald-700">
                        {((row.addPayNormal ?? 0) + (row.addPayOvertime ?? 0) + (row.addPayAllowance ?? 0)) > 0 
                          ? `$${((row.addPayNormal ?? 0) + (row.addPayOvertime ?? 0) + (row.addPayAllowance ?? 0)).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-red-700">
                        {((row.payrollDeduction ?? 0) + (row.leavePayNoPaid ?? 0)) > 0
                          ? `$${((row.payrollDeduction ?? 0) + (row.leavePayNoPaid ?? 0)).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.remark || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!result && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
              <p className="text-base font-semibold text-[var(--foreground)]">No file processed yet</p>
              <p className="mt-1">Upload an Excel or PDF timesheet to see the normalized preview here.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
