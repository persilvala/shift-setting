"use client";

import React, { useMemo, useState } from "react";
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

export default function PayrollPage() {
  const [timesheetData, setTimesheetData] = useState<ParsedTimesheetRow[] | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load timesheet data from sessionStorage on mount
  React.useEffect(() => {
    const stored = sessionStorage.getItem("timesheetData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ParsedTimesheetRow[];
        setTimesheetData(parsed);
      } catch (e) {
        console.error("Failed to parse stored timesheet data");
      }
    }
  }, []);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [basePayPerDay, setBasePayPerDay] = useState<number>(50);
  const [overtimeRatePerHour, setOvertimeRatePerHour] = useState<number>(10);

  // Additional pay and deductions per employee
  const [additionalPay, setAdditionalPay] = useState<Record<string, Array<{ description: string; amount: number }>>>({});
  const [deductions, setDeductions] = useState<Record<string, Array<{ description: string; amount: number }>>>({});

  const totalNetPay = useMemo(() => {
    return payrollData?.payroll.reduce((sum, entry) => sum + entry.netPay, 0) ?? 0;
  }, [payrollData]);

  const handleGeneratePayroll = async () => {
    if (!timesheetData || !startDate || !endDate || !basePayPerDay) {
      setError("Please fill in all required fields and upload timesheet data");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const transformedData = timesheetData.map((row) => ({
        userId: row.userId ?? "",
        employeeName: row.employeeName,
        department: row.dept ?? "",
        workHours: row.totalHours ?? 0,
        overtimeHours: row.overtimeHours ?? 0,
        workDays: row.workDays ?? "0/0",
        lateMinutes: row.lateMinutes ?? 0,
        earlyMinutes: row.earlyMinutes ?? 0,
        addPayNormal: row.addPayNormal ?? 0,
        addPayOvertime: row.addPayOvertime ?? 0,
        addPayAllowance: row.addPayAllowance ?? 0,
        payrollDeduction: row.payrollDeduction ?? 0,
      }));

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdditionalPay = (userId: string) => {
    const desc = prompt("Description:");
    if (!desc) return;
    const amount = parseFloat(prompt("Amount:") ?? "0");
    if (isNaN(amount)) return;

    setAdditionalPay((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] ?? []), { description: desc, amount }],
    }));
  };

  const handleAddDeduction = (userId: string) => {
    const desc = prompt("Description:");
    if (!desc) return;
    const amount = parseFloat(prompt("Amount:") ?? "0");
    if (isNaN(amount)) return;

    setDeductions((prev) => ({
      ...prev,
      [userId]: [...(prev[userId] ?? []), { description: desc, amount }],
    }));
  };

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Payroll</p>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            Generate Payroll
          </h1>
          {timesheetData ? (
            <p className="text-sm text-[var(--muted)]">
              Loaded {timesheetData.length} employee(s) from timesheet
            </p>
          ) : (
            <p className="text-sm text-amber-600">
              No timesheet data loaded. Please upload a timesheet first.
            </p>
          )}
        </header>

        {/* Configuration Section */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Payroll Settings</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">Base Pay per Day</label>
              <input
                type="number"
                value={basePayPerDay || ""}
                onChange={(e) => setBasePayPerDay(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">OT Rate per Hour</label>
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
              {loading ? "Generating..." : "Generate Payroll"}
            </button>
            {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
          </div>
        </section>

        {/* Payroll Results */}
        {payrollData && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Payroll Summary</p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {payrollData.startDate} to {payrollData.endDate}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--muted)]">Total Net Pay</p>
                <p className="text-2xl font-bold text-[var(--accent)]">${totalNetPay.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Base Pay</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Pay</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Additions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Deductions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Net Pay</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {payrollData.payroll.map((entry) => {
                    const empAdditionalPay = additionalPay[entry.userId] ?? [];
                    const empDeductions = deductions[entry.userId] ?? [];
                    const totalAdd = empAdditionalPay.reduce((s, a) => s + a.amount, 0);
                    const totalDed = empDeductions.reduce((s, d) => s + d.amount, 0);
                    const adjustedNet = entry.basePay + entry.overtimePay + totalAdd - totalDed;

                    return (
                      <tr key={entry.userId} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-3 font-semibold">{entry.employeeName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.department}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.workDays}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">${entry.basePay.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">${entry.overtimePay.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {empAdditionalPay.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {empAdditionalPay.map((a, i) => (
                                <span key={i} className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                                  {a.description}: ${a.amount.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => handleAddAdditionalPay(entry.userId)}
                            className="mt-1 text-xs font-semibold text-emerald-600 hover:underline"
                          >
                            + Add
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {empDeductions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {empDeductions.map((d, i) => (
                                <span key={i} className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                                  {d.description}: ${d.amount.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => handleAddDeduction(entry.userId)}
                            className="mt-1 text-xs font-semibold text-red-600 hover:underline"
                          >
                            + Add
                          </button>
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--foreground)]">${adjustedNet.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <button className="text-xs font-semibold text-[var(--accent)] hover:underline">Export</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
