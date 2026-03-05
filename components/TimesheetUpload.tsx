"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ParsedTimesheetRow } from "@/lib/timesheetParser";

type UploadSuccess = {
  ok: true;
  format: "excel" | "pdf";
  rows: ParsedTimesheetRow[];
  warnings: string[];
  startDate?: string | null;
  endDate?: string | null;
  timesheetId?: string;
};

type UploadError = { ok: false; error: string };

const PREVIEW_LIMIT = 50;

export function TimesheetUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const previewRows = useMemo(() => (result?.rows ?? []).slice(0, PREVIEW_LIMIT), [result]);
  const totalRows = result?.rows.length ?? 0;

  // Restore dates from sessionStorage on mount
  useEffect(() => {
    const metaRaw = sessionStorage.getItem("timesheetMeta");
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        if (meta.startDate) setStartDate(meta.startDate);
        if (meta.endDate) setEndDate(meta.endDate);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleGeneratePayroll = () => {
    if (!result?.rows.length) {
      setError("Upload and parse a timesheet first.");
      return;
    }
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

      const response = await fetch("/api/timesheets/upload", { method: "POST", body });
      const data = (await response.json()) as UploadSuccess | UploadError;

      if (!response.ok || !data.ok) {
        const message = "error" in data ? data.error : "Failed to parse file";
        setError(message);
        return;
      }

      const dedup = new Set<string>();

      const mappedRows = data.rows
        .map((row) => ({ ...row } satisfies ParsedTimesheetRow))
        .filter((row) => {
          const k = [row.employeeName ?? "", row.date ?? "", row.timeIn ?? "", row.timeOut ?? "", row.totalHours ?? ""].join("|#|");
          if (dedup.has(k)) return false;
          dedup.add(k);
          return true;
        });

      setResult({ ...data, rows: mappedRows });
      setStartDate(data.startDate ?? null);
      setEndDate(data.endDate ?? null);
      sessionStorage.setItem("timesheetData", JSON.stringify(mappedRows));
      sessionStorage.setItem(
        "timesheetMeta",
        JSON.stringify({
          format: data.format,
          totalRows: mappedRows.length,
          uploadedAt: new Date().toISOString(),
          startDate: data.startDate,
          endDate: data.endDate,
          timesheetId: data.timesheetId,
        })
      );

      // Notify dashboard to refresh
      window.dispatchEvent(new CustomEvent('timesheet-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatHours = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    return Number(value).toFixed(2);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Timesheets</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            Upload the timesheet template and review the rows.
          </h1>
          <button
            onClick={handleGeneratePayroll}
            disabled={!result?.rows.length}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate payroll →
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Upload</p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Pick an Excel, CSV, or PDF</h2>
            <p className="text-sm text-[var(--muted)]">Required fields: Name and Date. Optional: Time In, Time Out, Hours.</p>
          </div>
          <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">Parser ready</span>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/90 px-5 py-5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--foreground)]">Choose a file</p>
                <p>Use the provided timesheet template. Any casing works for the headers.</p>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">Required: Name + Date</div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">Optional: Time In / Out / Hours</div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">Hours are auto-computed if Time In/Out exist</div>
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

      {result ? (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Preview</p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">First {PREVIEW_LIMIT} rows</h3>
              <p className="text-sm text-[var(--muted)]">All rows are stored for salary computation.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold text-[var(--muted)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">Rows: {totalRows}</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">Format: {result.format.toUpperCase()}</span>
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 text-[var(--accent)]">
                  Period: {startDate ?? "—"} to {endDate ?? "—"}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[1400px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Weekday</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Start</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">End</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Before Noon In</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Before Noon Out</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">After Noon In</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">After Noon Out</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Overtime In</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Overtime Out</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {previewRows.map((row, idx) => {
                    return (
                      <tr key={`${row.employeeName}-${row.date}-${row.timeIn}-${idx}`} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.employeeName || "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.date || "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.weekday || "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{startDate ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{endDate ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.beforeNoonIn ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.beforeNoonOut ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.afterNoonIn ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.afterNoonOut ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.overtimeIn ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{row.overtimeOut ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatHours(row.totalHours)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
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
