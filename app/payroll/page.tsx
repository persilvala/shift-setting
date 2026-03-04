"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/TopNav";
import type { ParsedTimesheetRow } from "@/lib/timesheetParser";
import type { PayrollEntry } from "@/app/api/payroll/generate/route";

type PayrollData = {
  payroll: PayrollEntry[];
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  overtimeRatePerHour: number;
};

type Adjustment = { addition: number; deduction: number };

type TimesheetMeta = {
  format?: "excel" | "pdf";
  totalRows?: number;
  uploadedAt?: string;
};

export default function PayrollPage() {
  const [timesheetData, setTimesheetData] = useState<ParsedTimesheetRow[]>([]);
  const [timesheetMeta, setTimesheetMeta] = useState<TimesheetMeta | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [basePayPerDay, setBasePayPerDay] = useState<number>(0);
  const [overtimeRatePerHour, setOvertimeRatePerHour] = useState<number>(0);
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({});

  useEffect(() => {
    const stored = sessionStorage.getItem("timesheetData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ParsedTimesheetRow[];
        setTimesheetData(parsed);
      } catch {
        setTimesheetData([]);
      }
    }

    const metaRaw = sessionStorage.getItem("timesheetMeta");
    if (metaRaw) {
      try {
        const parsedMeta = JSON.parse(metaRaw) as TimesheetMeta;
        setTimesheetMeta(parsedMeta);
      } catch {
        setTimesheetMeta(null);
      }
    }
  }, []);

  const totalNetPay = useMemo(() => {
    if (!payrollData) return 0;
    return payrollData.payroll.reduce((sum, entry) => {
      const adj = adjustments[entry.userId] ?? { addition: 0, deduction: 0 };
      return sum + entry.netPay + adj.addition - adj.deduction;
    }, 0);
  }, [adjustments, payrollData]);

  const aggregatedTimesheet = (rows: ParsedTimesheetRow[]) => {
    type WorkingRow = {
      userId: string;
      employeeName: string;
      department: string;
      workHours: number;
      overtimeHours: number;
      dates: Set<string>;
      lateMinutes: number;
      earlyMinutes: number;
      addPayNormal: number;
      addPayOvertime: number;
      addPayAllowance: number;
      payrollDeduction: number;
    };

    const byUser = new Map<string, WorkingRow>();

    rows.forEach((row, index) => {
      const key = row.userId || row.employeeName || `row-${index}`;
      if (!key) return;

      if (!byUser.has(key)) {
        byUser.set(key, {
          userId: row.userId || key,
          employeeName: row.employeeName || "Unnamed",
          department: row.dept || "",
          workHours: 0,
          overtimeHours: 0,
          dates: new Set<string>(),
          lateMinutes: 0,
          earlyMinutes: 0,
          addPayNormal: 0,
          addPayOvertime: 0,
          addPayAllowance: 0,
          payrollDeduction: 0,
        });
      }

      const entry = byUser.get(key)!;
      entry.workHours += row.totalHours ?? 0;
      entry.overtimeHours += row.overtimeHours ?? 0;
      entry.lateMinutes += row.lateMinutes ?? 0;
      entry.earlyMinutes += row.earlyMinutes ?? 0;
      entry.addPayNormal += row.addPayNormal ?? 0;
      entry.addPayOvertime += row.addPayOvertime ?? 0;
      entry.addPayAllowance += row.addPayAllowance ?? 0;
      entry.payrollDeduction += row.payrollDeduction ?? 0;
      if (row.date) entry.dates.add(row.date);
    });

    return Array.from(byUser.values()).map((entry) => ({
      userId: entry.userId,
      employeeName: entry.employeeName,
      department: entry.department,
      workHours: Math.round(entry.workHours * 100) / 100,
      overtimeHours: Math.round(entry.overtimeHours * 100) / 100,
      workDays: `${entry.dates.size}/${entry.dates.size}`,
      lateMinutes: entry.lateMinutes,
      earlyMinutes: entry.earlyMinutes,
      addPayNormal: entry.addPayNormal,
      addPayOvertime: entry.addPayOvertime,
      addPayAllowance: entry.addPayAllowance,
      payrollDeduction: entry.payrollDeduction,
    }));
  };

  const handleGeneratePayroll = async () => {
    if (!timesheetData.length) {
      setError("Upload and parse a timesheet first.");
      return;
    }

    if (!startDate || !endDate || !basePayPerDay) {
      setError("Enter start date, end date, and base pay per day.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setError("Enter a valid date range (start on/before end).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const transformedData = aggregatedTimesheet(timesheetData);

      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          basePayPerDay,
          overtimeRatePerHour,
          timesheetData: transformedData,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.error ?? "Failed to generate payroll");
        return;
      }

      setPayrollData({
        payroll: result.payroll,
        startDate,
        endDate,
        basePayPerDay,
        overtimeRatePerHour,
      });
      setAdjustments({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!payrollData) {
      setError("Generate payroll before exporting.");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/payroll/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payroll: payrollData.payroll,
          startDate: payrollData.startDate,
          endDate: payrollData.endDate,
          basePayPerDay: payrollData.basePayPerDay,
          overtimeRatePerHour: payrollData.overtimeRatePerHour,
          adjustments,
          timesheetMeta: timesheetMeta ?? undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error ?? "Failed to export payroll";
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `payroll-${payrollData.startDate}-to-${payrollData.endDate}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export payroll");
    } finally {
      setExporting(false);
    }
  };

  const handleAdjustmentChange = (userId: string, type: keyof Adjustment, value: string) => {
    const parsed = Number(value) || 0;
    setAdjustments((prev) => ({
      ...prev,
      [userId]: {
        addition: type === "addition" ? parsed : prev[userId]?.addition ?? 0,
        deduction: type === "deduction" ? parsed : prev[userId]?.deduction ?? 0,
      },
    }));
  };

  const formatMoney = (value: number) => `$${value.toFixed(2)}`;

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Payroll</p>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">Compute salary from the uploaded timesheet.</h1>
          {timesheetData.length ? (
            <p className="text-sm text-[var(--muted)]">
              Loaded {timesheetData.length} row(s) from the latest upload
              {timesheetMeta?.format ? ` (${timesheetMeta.format.toUpperCase()})` : ""}.
            </p>
          ) : (
            <p className="text-sm text-amber-700">No timesheet data found. Upload on the Timesheets tab first.</p>
          )}
        </header>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Payroll period and rates</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">Base pay per day</label>
              <input
                type="number"
                value={basePayPerDay || ""}
                onChange={(e) => setBasePayPerDay(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">OT rate per hour</label>
              <input
                type="number"
                value={overtimeRatePerHour || ""}
                onChange={(e) => setOvertimeRatePerHour(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleGeneratePayroll}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-80"
            >
              {loading ? "Generating…" : "Generate payroll summary"}
            </button>
            {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
          </div>
        </section>

        {payrollData && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Payroll summary</p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">{payrollData.startDate} → {payrollData.endDate}</h3>
                <p className="text-sm text-[var(--muted)]">Base pay per day: {formatMoney(payrollData.basePayPerDay)} · OT rate: {formatMoney(payrollData.overtimeRatePerHour)}</p>
              </div>
              <div className="flex flex-col items-end gap-3 sm:items-end">
                <div className="text-right">
                  <p className="text-sm text-[var(--muted)]">Total net (with adjustments)</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">{formatMoney(totalNetPay)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-sm font-semibold text-[var(--muted)]">
                  {timesheetMeta?.format ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">
                      Source: {timesheetMeta.format.toUpperCase()}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting ? "Exporting…" : "Export payroll CSV"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Days</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Hours</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Base pay</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT pay</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Auto add</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Auto deduct</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Add (+)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Deduct (-)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {payrollData.payroll.map((entry) => {
                      const adj = adjustments[entry.userId] ?? { addition: 0, deduction: 0 };
                      const adjustedNet = entry.netPay + adj.addition - adj.deduction;
                      return (
                        <tr key={entry.userId} className="hover:bg-[var(--surface)]/60">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[var(--foreground)]">{entry.employeeName}</p>
                            <p className="text-xs text-[var(--muted)]">{entry.department}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">{entry.workDays}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{entry.workHours.toFixed(2)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.basePay)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.overtimePay)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.totalAdditions)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.totalDeductions)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={adj.addition || ""}
                              onChange={(e) => handleAdjustmentChange(entry.userId, "addition", e.target.value)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={adj.deduction || ""}
                              onChange={(e) => handleAdjustmentChange(entry.userId, "deduction", e.target.value)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-[var(--foreground)]">{formatMoney(adjustedNet)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
