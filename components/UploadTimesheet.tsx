"use client";

import { useState } from "react";
import { parseExcelFile } from "@/lib/excelParser";
import { summarizeAttendance, type AttendanceSummary } from "@/lib/attendanceCalculator";

type Props = {
  onResults: (rows: AttendanceSummary[]) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export function UploadTimesheet({ onResults, onLoadingChange }: Props) {
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setLoading(true);
    onLoadingChange?.(true);

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseExcelFile(buffer);
      if (!rows.length) {
        setError("No usable attendance rows found. Check headers and data.");
        onResults([]);
        setLoading(false);
        return;
      }
      const summary = summarizeAttendance(rows);
      onResults(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      onResults([]);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Upload</p>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Upload Excel or CSV</h2>
          <p className="text-sm text-[var(--muted)]">Supported: .xlsx, .xls, .csv. Processing runs on the client.</p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">{loading ? "Processing…" : fileName || "No file"}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">Shift Setting, Attendance, Time Card sheets supported</div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">Auto-detects employee, date, time columns</div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01]">
          {loading ? "Processing…" : "Choose file"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={handleFile}
            disabled={loading}
          />
        </label>
        {error ? <span className="text-sm font-semibold text-red-600">{error}</span> : null}
        {!error && loading ? <span className="text-sm text-[var(--muted)]">Working on it…</span> : null}
      </div>
    </section>
  );
}
