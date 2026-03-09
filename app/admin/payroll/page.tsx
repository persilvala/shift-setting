"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import type { ParsedTimesheetRow, PayrollEntry, TimesheetMeta, Adjustment, SavedPayroll } from "@/lib/types";
import { addAdminLog } from "@/lib/adminLogs";

type PayrollData = {
  payroll: PayrollEntry[];
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  overtimeRatePerHour: number;
};

function buildAggregatedTimesheet(rows: ParsedTimesheetRow[]) {
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
}

export default function PayrollPage() {
  const [timesheetData, setTimesheetData] = useState<ParsedTimesheetRow[]>([]);
  const [timesheetMeta, setTimesheetMeta] = useState<TimesheetMeta | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [savedPayrolls, setSavedPayrolls] = useState<SavedPayroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [basePayPerDay, setBasePayPerDay] = useState<number>(0);
  const [overtimeRatePerHour, setOvertimeRatePerHour] = useState<number>(0);
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({});
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [pendingPayroll, setPendingPayroll] = useState<{
    aggregated: ReturnType<typeof buildAggregatedTimesheet> | null;
    scopedRows: ParsedTimesheetRow[];
    employees: number;
    shifts: number;
    key: string;
  } | null>(null);
  const [showPayrollConfirm, setShowPayrollConfirm] = useState(false);
  const [locks, setLocks] = useState<string[]>([]);

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

    // Fetch saved payrolls from database
    fetchSavedPayrolls();
  }, []);

  const fetchSavedPayrolls = async () => {
    try {
      const response = await fetch("/api/payroll");
      const data = await response.json();
      if (data.payrolls) {
        setSavedPayrolls(data.payrolls);
      }
    } catch (err) {
      console.error("Failed to fetch saved payrolls:", err);
    }
  };

  const totalNetPay = useMemo(() => {
    if (!payrollData) return 0;
    return payrollData.payroll.reduce((sum, entry) => {
      const adj = adjustments[entry.userId] ?? { addition: 0, deduction: 0 };
      return sum + entry.netPay + (adj.addition ?? 0) - (adj.deduction ?? 0);
    }, 0);
  }, [adjustments, payrollData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLocks = localStorage.getItem("payroll-locks");
    if (storedLocks) {
      try {
        setLocks(JSON.parse(storedLocks));
      } catch {
        setLocks([]);
      }
    }
  }, []);

  const employees = useMemo(() => {
    return Array.from(new Set(timesheetData.map((row) => row.employeeName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [timesheetData]);

  const filteredShifts = useMemo(() => {
    if (!timesheetData.length) return [] as ParsedTimesheetRow[];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return timesheetData.filter((row) => {
      if (!row.date) return false;
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime())) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      if (selectedUser !== "all") {
        const key = row.userId || row.employeeName;
        if (!key) return false;
        if (key !== selectedUser && row.employeeName !== selectedUser) return false;
      }
      return true;
    });
  }, [endDate, selectedUser, startDate, timesheetData]);

  const payrollLookup = useMemo(() => {
    const map = new Map<string, PayrollEntry>();
    payrollData?.payroll.forEach((entry) => map.set(entry.employeeName, entry));
    return map;
  }, [payrollData]);

  const handleGeneratePayroll = () => {
    setError(null);
    setSuccess(null);

    if (!timesheetData.length) {
      setError("Upload and parse a timesheet first.");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "No timesheet rows available." });
      return;
    }

    if (!startDate || !endDate) {
      setError("Enter start and end dates.");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "Missing date range." });
      return;
    }

    if (basePayPerDay <= 0) {
      setError("Base pay per day must be greater than zero.");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "Base pay per day is not valid." });
      return;
    }

    if (overtimeRatePerHour < 0) {
      setError("OT rate per hour cannot be negative.");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "OT rate is negative." });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setError("Enter a valid date range (start on/before end).");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "Invalid date range." });
      return;
    }

    const inRange = timesheetData.filter((row) => {
      if (!row.date) return false;
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });

    const scopedRows = selectedUser === "all"
      ? inRange
      : inRange.filter((row) => {
          const key = row.userId || row.employeeName;
          return key === selectedUser || row.employeeName === selectedUser;
        });

    if (!scopedRows.length) {
      setError("No attended shifts match the selected user/date range.");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "No shifts found for selection." });
      return;
    }

    const lockKey = `${selectedUser}|${startDate}|${endDate}`;
    if (locks.includes(lockKey)) {
      setError("Payroll already generated for this user and date range.");
      addAdminLog({ action: "Payroll validation", status: "Failed", description: "Duplicate payroll prevented." });
      return;
    }

    const aggregated = buildAggregatedTimesheet(scopedRows);
    setPendingPayroll({
      aggregated,
      scopedRows,
      employees: aggregated.length,
      shifts: scopedRows.length,
      key: lockKey,
    });
    setShowPayrollConfirm(true);
    addAdminLog({
      action: "Payroll validation",
      status: "Success",
      description: `Validated ${aggregated.length} employee(s) between ${startDate} and ${endDate}`,
    });
  };

  const confirmPayrollGeneration = async () => {
    if (!pendingPayroll || !pendingPayroll.aggregated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          basePayPerDay,
          overtimeRatePerHour,
          timesheetData: pendingPayroll.aggregated,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        const message = result.error ?? "Failed to generate payroll";
        setError(message);
        addAdminLog({ action: "Payroll generation", status: "Failed", description: message });
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
      setShowPayrollConfirm(false);
      addAdminLog({
        action: "Payroll generation",
        status: "Success",
        description: `Generated payroll for ${pendingPayroll.employees} employee(s) covering ${pendingPayroll.shifts} shifts`,
      });

      const nextLocks = Array.from(new Set([...locks, pendingPayroll.key]));
      setLocks(nextLocks);
      if (typeof window !== "undefined") {
        const totalNet = Array.isArray(result.payroll)
          ? result.payroll.reduce((sum: number, entry: PayrollEntry) => sum + entry.netPay, 0)
          : 0;
        localStorage.setItem("payroll-locks", JSON.stringify(nextLocks));
        localStorage.setItem(
          "lastPayrollConfirmation",
          JSON.stringify({
            startDate,
            endDate,
            employees: pendingPayroll.employees,
            shifts: pendingPayroll.shifts,
            totalNet,
            generatedAt: new Date().toISOString(),
          })
        );
        window.dispatchEvent(new CustomEvent('payroll-generated'));
      }
      setPendingPayroll(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
      addAdminLog({ action: "Payroll generation", status: "Failed", description: message });
    } finally {
      setLoading(false);
    }
  };

  const cancelPayrollConfirm = () => {
    setShowPayrollConfirm(false);
    setPendingPayroll(null);
    addAdminLog({ action: "Payroll generation", status: "Cancelled", description: "Payroll confirmation cancelled" });
  };

  const handleSavePayroll = async () => {
    if (!payrollData) {
      setError("Generate payroll first before saving.");
      addAdminLog({ action: "Payroll save", status: "Failed", description: "Attempted to save without generated payroll." });
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payrollWithAdjustments = payrollData.payroll.map((entry) => {
        const adj = adjustments[entry.userId] ?? { addition: 0, deduction: 0 };
        return {
          ...entry,
          manualAddition: adj.addition,
          manualDeduction: adj.deduction,
        };
      });

      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: payrollData.startDate,
          endDate: payrollData.endDate,
          basePayPerDay: payrollData.basePayPerDay,
          overtimeRate: payrollData.overtimeRatePerHour,
          payroll: payrollWithAdjustments,
          timesheetId: timesheetMeta?.timesheetId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.error ?? "Failed to save payroll");
        addAdminLog({ action: "Payroll save", status: "Failed", description: result.error ?? "Failed to save payroll" });
        return;
      }

      setSuccess("Payroll saved to database successfully!");
      addAdminLog({ action: "Payroll save", status: "Success", description: `Saved ${payrollData.payroll.length} payroll entries.` });
      fetchSavedPayrolls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payroll");
      addAdminLog({ action: "Payroll save", status: "Failed", description: err instanceof Error ? err.message : "Failed to save payroll" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = async () => {
    if (!payrollData) {
      setError("Generate payroll before exporting.");
      addAdminLog({ action: "Payroll export", status: "Failed", description: "No payroll data to export." });
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
      addAdminLog({ action: "Payroll export", status: "Success", description: `Exported payroll CSV (${filename}).` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export payroll");
      addAdminLog({ action: "Payroll export", status: "Failed", description: err instanceof Error ? err.message : "Failed to export payroll" });
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">User scope</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="all">All users</option>
                {employees.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
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
            {payrollData && (
              <button
                onClick={handleSavePayroll}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-5 py-3 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save to database"}
              </button>
            )}
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              In scope: {filteredShifts.length} shifts · {selectedUser === "all" ? `${employees.length || 0} employee(s)` : selectedUser}
            </span>
            {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
            {success && <span className="text-sm font-semibold text-emerald-600">{success}</span>}
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
                      const adjustedNet = entry.netPay + (adj.addition ?? 0) - (adj.deduction ?? 0);
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

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Employee shifts</p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">Attendance driving payroll</h3>
              <p className="text-sm text-[var(--muted)]">Attended shifts in the selected range feed payroll calculations. Filters sit above the table.</p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">{filteredShifts.length} shift(s) in view</span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Time in</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Time out</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Hours worked</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Attendance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Payroll record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center text-[var(--muted)]">No shifts found for the current filters.</td>
                    </tr>
                  ) : (
                    filteredShifts.map((row, idx) => {
                      const status = row.issues && row.issues.length > 0 ? "Attention" : "Present";
                      const payrollRecord = payrollLookup.get(row.employeeName ?? "");
                      return (
                        <tr key={`${row.employeeName}-${row.date}-${idx}`} className="hover:bg-[var(--surface)]/60">
                          <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.employeeName || "—"}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.date || "—"}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.timeIn || "—"}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.timeOut || "—"}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{(row.totalHours ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Present" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {payrollRecord ? `Net: $${payrollRecord.netPay.toFixed(2)}` : "Pending"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {savedPayrolls.length > 0 && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Saved payrolls</p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">From database</h3>
                <p className="text-sm text-[var(--muted)]">Previously generated and saved payroll records.</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Period</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Generated</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Entries</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Base Pay/Day</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">OT Rate/Hour</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Total Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {savedPayrolls.map((payroll) => (
                      <tr key={payroll.id} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                          {new Date(payroll.startDate).toLocaleDateString()} – {new Date(payroll.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {new Date(payroll.generatedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{payroll._count.entries}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(payroll.basePayPerDay)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(payroll.overtimeRate)}</td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">{formatMoney(payroll.totalNetPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {showPayrollConfirm && pendingPayroll ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">Confirm payroll</p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">Generate after review</h3>
                </div>
                <button
                  type="button"
                  onClick={cancelPayrollConfirm}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 p-4 text-sm text-[var(--foreground)] sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[var(--muted)]">Date range</p>
                  <p className="font-semibold">{startDate} → {endDate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[var(--muted)]">Employees in scope</p>
                  <p className="font-semibold">{pendingPayroll.employees}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[var(--muted)]">Total shifts</p>
                  <p className="font-semibold">{pendingPayroll.shifts}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[var(--muted)]">Estimated payroll records</p>
                  <p className="font-semibold">{pendingPayroll.aggregated?.length ?? 0}</p>
                </div>
              </div>

              {error && !loading ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelPayrollConfirm}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPayrollGeneration}
                  disabled={loading}
                  className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(47,109,246,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Generating…" : "Generate payroll"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
