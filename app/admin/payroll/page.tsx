"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { PageHeader } from "@/components/PageHeader";
import type {
  ParsedTimesheetRow,
  TimesheetMeta,
  SavedPayroll,
  Employee,
} from "@/lib/types";
import { addAdminLog } from "@/lib/adminLogs";
import { Pagination } from "@/components/Pagination";

type PayrollEntryRow = {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  attendanceDays: number;
  halfDays: number;
  absentDays: number;
  basePayPerDay: number | null;
  basePay: number;
  addedValue: number;
  subtractedValue: number;
  netPay: number;
  isEdited: boolean;
  timesheetRowIds: string[];
};

type PayrollData = {
  payroll: PayrollEntryRow[];
  startDate: string;
  endDate: string;
};

type PendingTimesheet = {
  id: string;
  fileName: string | null;
  format: string | null;
  entrySource: string | null;
  startDate: string;
  endDate: string;
  uploadedAt: string;
  totalRows: number;
  employeeCount: number;
};

type ProcessedTimesheet = {
  id: string;
  fileName: string | null;
  format: string | null;
  entrySource: string | null;
  startDate: string;
  endDate: string;
  uploadedAt: string;
  totalRows: number;
  employeeCount: number;
  payrolls: Array<{
    id: string;
    totalNetPay: number;
    basePayPerDay: number;
    createdAt: string;
  }>;
};

function buildAttendanceData(rows: ParsedTimesheetRow[]) {
  type WorkingRow = {
    employeeId: string;
    employeeName: string;
    attendanceDays: number;
    halfDays: number;
    absentDays: number;
    timesheetRowIds: string[];
  };

  const byEmployee = new Map<string, WorkingRow>();

  rows.forEach((row) => {
    const key = row.employeeId || row.employeeName;
    if (!key) return;

    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: row.employeeId || key,
        employeeName: row.employeeName || "Unnamed",
        attendanceDays: 0,
        halfDays: 0,
        absentDays: 0,
        timesheetRowIds: [],
      });
    }

    const entry = byEmployee.get(key)!;
    if (row.id) {
      entry.timesheetRowIds.push(row.id);
    }
    const status = row.attendanceStatus || "full_day";
    switch (status) {
      case "full_day":
        entry.attendanceDays++;
        break;
      case "half_day":
        entry.halfDays++;
        break;
      case "absent":
        entry.absentDays++;
        break;
    }
  });

  return Array.from(byEmployee.values());
}

export default function PayrollPage() {
  const [timesheetData, setTimesheetData] = useState<ParsedTimesheetRow[]>([]);
  const [timesheetMeta, setTimesheetMeta] = useState<TimesheetMeta | null>(
    null,
  );
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [savedPayrolls, setSavedPayrolls] = useState<SavedPayroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payrollPage, setPayrollPage] = useState(1);
  const [savedPage, setSavedPage] = useState(1);
  const [missingBasePayWarning, setMissingBasePayWarning] = useState<string[]>(
    [],
  );
  const PAGE_SIZE = 10;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [defaultBasePayPerDay, setDefaultBasePayPerDay] = useState<number>(0);
  const [pendingPayroll, setPendingPayroll] = useState<{
    aggregated: ReturnType<typeof buildAttendanceData>;
    employees: number;
    shifts: number;
    key: string;
  } | null>(null);
  const [showPayrollConfirm, setShowPayrollConfirm] = useState(false);
  const [locks, setLocks] = useState<string[]>([]);

  const [editModal, setEditModal] = useState<{
    employeeId: string;
    employeeName: string;
    attendanceDays: number;
    halfDays: number;
    absentDays: number;
    addedValue: number;
    subtractedValue: number;
    netPay: number;
    basePay: number;
    basePayPerDay: number | null;
    isEdited: boolean;
  } | null>(null);

  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<{
    id: string;
    startDate: string;
    endDate: string;
    basePayPerDay: number;
    totalNetPay: number;
    isEdited: boolean;
    generatedAt: string;
    entries: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
      basePay: number;
      addedValue: number;
      subtractedValue: number;
      netPay: number;
      isEdited: boolean;
    }>;
  } | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);

  const [pendingTimesheets, setPendingTimesheets] = useState<PendingTimesheet[]>([]);
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [processedTimesheets, setProcessedTimesheets] = useState<ProcessedTimesheet[]>([]);
  const [processedStartDate, setProcessedStartDate] = useState("");
  const [processedEndDate, setProcessedEndDate] = useState("");
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingProcessed, setLoadingProcessed] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees");
      const data = await response.json();
      if (data.employees) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  }, []);

  const fetchPayrollDetail = useCallback(async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}`);
      const data = await response.json();
      if (data.payroll) {
        setSelectedPayrollDetail(data.payroll);
      }
    } catch (err) {
      console.error("Failed to fetch payroll detail:", err);
    }
  }, []);

  useEffect(() => {
    const fetchPendingTimesheets = async () => {
      try {
        setLoadingPending(true);
        const response = await fetch("/api/timesheets/pending");
        const data = await response.json();
        if (data.timesheets) {
          setPendingTimesheets(data.timesheets);
        }
      } catch (err) {
        console.error("Failed to fetch pending timesheets:", err);
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPendingTimesheets();
    fetchSavedPayrolls();
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const fetchProcessedTimesheets = async () => {
      try {
        setLoadingProcessed(true);
        const params = new URLSearchParams();
        if (processedStartDate) params.append("startDate", processedStartDate);
        if (processedEndDate) params.append("endDate", processedEndDate);
        const response = await fetch(`/api/timesheets/processed?${params.toString()}`);
        const data = await response.json();
        if (data.timesheets) {
          setProcessedTimesheets(data.timesheets);
        }
      } catch (err) {
        console.error("Failed to fetch processed timesheets:", err);
      } finally {
        setLoadingProcessed(false);
      }
    };

    fetchProcessedTimesheets();
  }, [processedStartDate, processedEndDate]);

  useEffect(() => {
    const fetchTimesheetRows = async () => {
      if (!selectedTimesheetId) return;
      try {
        const response = await fetch(`/api/timesheets/${selectedTimesheetId}`);
        const data = await response.json();
        if (data.timesheet) {
          setTimesheetData(data.timesheet.rows || []);
          setTimesheetMeta({
            format: data.timesheet.format ?? "excel",
            timesheetId: data.timesheet.id ?? null,
            startDate: data.timesheet.startDate?.slice(0, 10) ?? null,
            endDate: data.timesheet.endDate?.slice(0, 10) ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to fetch timesheet rows:", err);
      }
    };

    fetchTimesheetRows();
  }, [selectedTimesheetId]);

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
    return payrollData.payroll.reduce((sum, entry) => sum + entry.netPay, 0);
  }, [payrollData]);

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

  useEffect(() => {
    setPayrollPage(1);
  }, [payrollData?.payroll?.length]);

  useEffect(() => {
    setSavedPage(1);
  }, [savedPayrolls.length]);

  const uniqueEmployees = useMemo(() => {
    return Array.from(
      new Set(timesheetData.map((row) => row.employeeName).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }, [timesheetData]);

  const filteredRows = useMemo(() => {
    if (!timesheetData.length) return [] as ParsedTimesheetRow[];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const scoped = selectedUser.trim().toLowerCase();
    return timesheetData.filter((row) => {
      if (!row.date) return false;
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime())) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      if (scoped) {
        const key = row.employeeId || row.employeeName || "";
        if (!key) return false;
        if (
          !key.toLowerCase().includes(scoped) &&
          !(row.employeeName || "").toLowerCase().includes(scoped)
        )
          return false;
      }
      return true;
    });
  }, [endDate, selectedUser, startDate, timesheetData]);

  useEffect(() => {
    setPayrollPage(1);
  }, [filteredRows.length]);

  const payrollTotalPages = payrollData
    ? Math.max(1, Math.ceil(payrollData.payroll.length / PAGE_SIZE))
    : 1;
  const payrollPageSafe = Math.min(payrollPage, payrollTotalPages);
  const paginatedPayroll = payrollData
    ? payrollData.payroll.slice(
        (payrollPageSafe - 1) * PAGE_SIZE,
        payrollPageSafe * PAGE_SIZE,
      )
    : [];

  const savedTotalPages = savedPayrolls.length
    ? Math.max(1, Math.ceil(savedPayrolls.length / PAGE_SIZE))
    : 1;
  const savedPageSafe = Math.min(savedPage, savedTotalPages);
  const paginatedSaved = savedPayrolls.slice(
    (savedPageSafe - 1) * PAGE_SIZE,
    savedPageSafe * PAGE_SIZE,
  );

  const getEmployeeBasePay = useCallback(
    (employeeId: string, employeeName: string): number | null => {
      const emp = employees.find(
        (e) => e.id === employeeId || e.employeeName === employeeName,
      );
      if (emp?.basePayPerDay !== null && emp?.basePayPerDay !== undefined) {
        return emp.basePayPerDay;
      }
      return defaultBasePayPerDay > 0 ? defaultBasePayPerDay : null;
    },
    [employees, defaultBasePayPerDay],
  );

  const handleGeneratePayroll = () => {
    setError(null);
    setSuccess(null);
    setMissingBasePayWarning([]);

    if (!timesheetData.length) {
      setError("Upload and parse a timesheet first.");
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "No timesheet rows available.",
      });
      return;
    }

    if (!startDate || !endDate) {
      setError("Enter start and end dates.");
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "Missing date range.",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      setError("Enter a valid date range (start on/before end).");
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "Invalid date range.",
      });
      return;
    }

    const inRange = timesheetData.filter((row) => {
      if (!row.date) return false;
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });

    const scoped = selectedUser.trim().toLowerCase();
    const scopedRows = scoped
      ? inRange.filter((row) => {
          const key = (row.employeeId || row.employeeName || "").toLowerCase();
          return key.includes(scoped);
        })
      : inRange;

    if (!scopedRows.length) {
      setError("No shifts match the selected user/date range.");
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "No shifts found for selection.",
      });
      return;
    }

    const lockKey = `${selectedUser.trim().toLowerCase() || "all"}|${startDate}|${endDate}`;
    if (locks.includes(lockKey)) {
      setError("Payroll already generated for this user and date range.");
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "Duplicate payroll prevented.",
      });
      return;
    }

    const aggregated = buildAttendanceData(scopedRows);

    const employeesWithoutBasePay = aggregated.filter((emp) => {
      const basePay = getEmployeeBasePay(emp.employeeId, emp.employeeName);
      return basePay === null;
    });

    if (employeesWithoutBasePay.length > 0) {
      const names = employeesWithoutBasePay
        .map((e) => e.employeeName)
        .join(", ");
      setMissingBasePayWarning(
        employeesWithoutBasePay.map((e) => e.employeeId || e.employeeName),
      );
      setError(`Please enter base pay per day for: ${names}`);
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: `Employees missing basePayPerDay: ${names}`,
      });
      return;
    }

    setPendingPayroll({
      aggregated,
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
      const payroll = pendingPayroll.aggregated.map((emp) => {
        const basePayPerDay = getEmployeeBasePay(
          emp.employeeId,
          emp.employeeName,
        );
        const basePay =
          emp.attendanceDays * (basePayPerDay ?? 0) +
          emp.halfDays * (basePayPerDay ?? 0) * 0.5;
        return {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          startDate,
          endDate,
          attendanceDays: emp.attendanceDays,
          halfDays: emp.halfDays,
          absentDays: emp.absentDays,
          basePayPerDay,
          basePay: Math.round(basePay * 100) / 100,
          addedValue: 0,
          subtractedValue: 0,
          netPay: Math.round(basePay * 100) / 100,
          isEdited: false,
          timesheetRowIds: emp.timesheetRowIds,
        };
      });

      setPayrollData({ payroll, startDate, endDate });
      setShowPayrollConfirm(false);
      setMissingBasePayWarning([]);
      addAdminLog({
        action: "Payroll generation",
        status: "Success",
        description: `Generated payroll for ${pendingPayroll.employees} employee(s) covering ${pendingPayroll.shifts} shifts`,
      });

      const nextLocks = Array.from(new Set([...locks, pendingPayroll.key]));
      setLocks(nextLocks);
      if (typeof window !== "undefined") {
        localStorage.setItem("payroll-locks", JSON.stringify(nextLocks));
        localStorage.setItem(
          "lastPayrollConfirmation",
          JSON.stringify({
            startDate,
            endDate,
            employees: pendingPayroll.employees,
            shifts: pendingPayroll.shifts,
            totalNet: payroll.reduce((sum, p) => sum + p.netPay, 0),
            generatedAt: new Date().toISOString(),
          }),
        );
        window.dispatchEvent(new CustomEvent("payroll-generated"));
      }
      setPendingPayroll(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
      addAdminLog({
        action: "Payroll generation",
        status: "Failed",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelPayrollConfirm = () => {
    setShowPayrollConfirm(false);
    setPendingPayroll(null);
    addAdminLog({
      action: "Payroll generation",
      status: "Cancelled",
      description: "Payroll confirmation cancelled",
    });
  };

  const handleSavePayroll = async () => {
    if (!payrollData) {
      setError("Generate payroll first before saving.");
      addAdminLog({
        action: "Payroll save",
        status: "Failed",
        description: "Attempted to save without generated payroll.",
      });
      return;
    }

    const missingBasePay = payrollData.payroll.filter(
      (p) => p.basePayPerDay === null || p.basePayPerDay === undefined,
    );
    if (missingBasePay.length > 0) {
      const names = missingBasePay.map((e) => e.employeeName).join(", ");
      setError(`Cannot save: Missing base pay for ${names}`);
      addAdminLog({
        action: "Payroll save",
        status: "Failed",
        description: `Missing basePayPerDay for: ${names}`,
      });
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const rowLevelEntries = payrollData.payroll.flatMap((emp) => {
        if (!emp.timesheetRowIds.length) {
          return [
            {
              employeeId: emp.employeeId,
              employeeName: emp.employeeName,
              timesheetRowId: "",
              basePayPerDay: emp.basePayPerDay,
              basePay: emp.basePay,
              addedValue: emp.addedValue,
              subtractedValue: emp.subtractedValue,
              netPay: emp.netPay,
            },
          ];
        }
        return emp.timesheetRowIds.map((rowId) => ({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          timesheetRowId: rowId,
          basePayPerDay: emp.basePayPerDay,
          basePay: emp.basePay / emp.timesheetRowIds.length,
          addedValue: emp.addedValue / emp.timesheetRowIds.length,
          subtractedValue: emp.subtractedValue / emp.timesheetRowIds.length,
          netPay: emp.netPay / emp.timesheetRowIds.length,
        }));
      });

      const avgBasePay =
        payrollData.payroll.reduce(
          (sum, p) => sum + (p.basePayPerDay ?? 0),
          0,
        ) / payrollData.payroll.length;

      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: payrollData.startDate,
          endDate: payrollData.endDate,
          basePayPerDay: avgBasePay,
          payroll: rowLevelEntries,
          timesheetId: timesheetMeta?.timesheetId,
        }),
      });

      const result = await response.json();

      console.log("[Payroll] Save response:", result);
      console.log("[Payroll] timesheetMeta:", timesheetMeta);
      console.log("[Payroll] selectedTimesheetId:", selectedTimesheetId);

      if (!response.ok || !result.ok) {
        setError(result.error ?? "Failed to save payroll");
        addAdminLog({
          action: "Payroll save",
          status: "Failed",
          description: result.error ?? "Failed to save payroll",
        });
        return;
      }

      await fetchEmployees();

      setSuccess("Payroll saved to database successfully!");
      addAdminLog({
        action: "Payroll save",
        status: "Success",
        description: `Saved ${payrollData.payroll.length} payroll entries.`,
      });
      fetchSavedPayrolls();

      const pendingResponse = await fetch("/api/timesheets/pending");
      const pendingData = await pendingResponse.json();
      console.log("[Payroll] Pending API response after save:", pendingData);
      if (pendingData.timesheets) {
        setPendingTimesheets(pendingData.timesheets);
        if (!pendingData.timesheets.find((t: PendingTimesheet) => t.id === selectedTimesheetId)) {
          setSelectedTimesheetId(null);
          setTimesheetData([]);
          setTimesheetMeta(null);
          setPayrollData(null);
          setPendingPayroll(null);
        }
      }

      const processedResponse = await fetch("/api/timesheets/processed");
      const processedData = await processedResponse.json();
      console.log("[Payroll] Processed API response after save:", processedData);
      if (processedData.timesheets) {
        setProcessedTimesheets(processedData.timesheets);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payroll");
      addAdminLog({
        action: "Payroll save",
        status: "Failed",
        description:
          err instanceof Error ? err.message : "Failed to save payroll",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePayrollBasePay = (
    employeeId: string,
    newBasePay: number | null,
  ) => {
    if (!payrollData) return;

    setPayrollData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        payroll: prev.payroll.map((entry) => {
          if (entry.employeeId === employeeId) {
            const basePay =
              entry.attendanceDays * (newBasePay ?? 0) +
              entry.halfDays * (newBasePay ?? 0) * 0.5;
            return {
              ...entry,
              basePayPerDay: newBasePay,
              basePay: Math.round(basePay * 100) / 100,
              netPay:
                Math.round(
                  (basePay + entry.addedValue - entry.subtractedValue) * 100,
                ) / 100,
            };
          }
          return entry;
        }),
      };
    });

    setMissingBasePayWarning((prev) => prev.filter((id) => id !== employeeId));
  };

  const openEditModal = (entry: PayrollEntryRow) => {
    setEditModal({
      employeeId: entry.employeeId,
      employeeName: entry.employeeName,
      attendanceDays: entry.attendanceDays,
      halfDays: entry.halfDays,
      absentDays: entry.absentDays,
      addedValue: entry.addedValue,
      subtractedValue: entry.subtractedValue,
      netPay: entry.netPay,
      basePay: entry.basePay,
      basePayPerDay: entry.basePayPerDay,
      isEdited: entry.isEdited,
    });
  };

  const saveEditModal = async () => {
    if (!editModal) return;

    const newBasePay =
      editModal.attendanceDays * (editModal.basePayPerDay ?? 0) +
      editModal.halfDays * (editModal.basePayPerDay ?? 0) * 0.5;
    const newNetPay =
      newBasePay + editModal.addedValue - editModal.subtractedValue;

    if (editingEntryId && editingPayrollId) {
      try {
        const response = await fetch(`/api/payroll/${editingPayrollId}/entries/${editingEntryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendanceDays: editModal.attendanceDays,
            halfDays: editModal.halfDays,
            absentDays: editModal.absentDays,
            basePay: Math.round(newBasePay * 100) / 100,
            addedValue: editModal.addedValue,
            subtractedValue: editModal.subtractedValue,
            netPay: Math.round(newNetPay * 100) / 100,
          }),
        });

        if (response.ok) {
          setSelectedPayrollDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              isEdited: true,
              entries: prev.entries.map((entry) =>
                entry.id === editingEntryId
                  ? {
                      ...entry,
                      attendanceDays: editModal.attendanceDays,
                      halfDays: editModal.halfDays,
                      absentDays: editModal.absentDays,
                      addedValue: editModal.addedValue,
                      subtractedValue: editModal.subtractedValue,
                      basePay: Math.round(newBasePay * 100) / 100,
                      netPay: Math.round(newNetPay * 100) / 100,
                      isEdited: true,
                    }
                  : entry,
              ),
            };
          });
          addAdminLog({
            action: "Payroll entry edit",
            status: "Success",
            description: `Edited payroll entry for ${editModal.employeeName} (saved payroll)`,
          });
        }
      } catch (err) {
        console.error("Failed to update payroll entry:", err);
      }
    } else if (payrollData) {
      setPayrollData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          payroll: prev.payroll.map((entry) =>
            entry.employeeId === editModal.employeeId
              ? {
                  ...entry,
                  attendanceDays: editModal.attendanceDays,
                  halfDays: editModal.halfDays,
                  absentDays: editModal.absentDays,
                  addedValue: editModal.addedValue,
                  subtractedValue: editModal.subtractedValue,
                  basePay: Math.round(newBasePay * 100) / 100,
                  netPay: Math.round(newNetPay * 100) / 100,
                  isEdited: true,
                }
              : entry,
          ),
        };
      });
      addAdminLog({
        action: "Payroll edit",
        status: "Success",
        description: `Edited payroll for ${editModal.employeeName}`,
      });
    }

    setEditModal(null);
    setEditingEntryId(null);
    setEditingPayrollId(null);
  };

  const formatMoney = (value: number) => `$${value.toFixed(2)}`;

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <PageHeader>Payroll</PageHeader>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            Generate payroll from pending timesheets.
          </h1>
        </header>

        {pendingTimesheets.length > 0 && !selectedTimesheetId && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Pending Timesheets
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Select a timesheet to generate payroll.
            </p>
            <div className="mt-4 space-y-3">
              {pendingTimesheets.map((ts) => (
                <button
                  key={ts.id}
                  onClick={() => setSelectedTimesheetId(ts.id)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white p-4 text-left transition hover:border-[var(--accent)] hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {ts.startDate} → {ts.endDate}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {ts.employeeCount} employees · {ts.totalRows} rows ·{" "}
                        {ts.format?.toUpperCase() ?? "Unknown"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {pendingTimesheets.length === 0 && !selectedTimesheetId && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
            <p className="text-center text-[var(--muted)]">
              No pending timesheets. Upload a timesheet on the Timesheets tab first.
            </p>
          </section>
        )}

        {selectedTimesheetId && (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedTimesheetId(null);
                  setTimesheetData([]);
                  setTimesheetMeta(null);
                  setPayrollData(null);
                  setPendingPayroll(null);
                }}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                ← Back to pending timesheets
              </button>
              {timesheetMeta && (
                <p className="text-sm text-[var(--muted)]">
                  Selected: {timesheetMeta.startDate} → {timesheetMeta.endDate} (
                  {timesheetData.length} rows)
                </p>
              )}
            </div>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Payroll period and filters
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="text-sm font-semibold text-[var(--muted)]">
                    Filter Employee
                  </label>
                  <input
                    type="search"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    placeholder="All employees"
                    list="payroll-user-suggestions"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                  <datalist id="payroll-user-suggestions">
                    {uniqueEmployees.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--muted)]">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--muted)]">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[var(--muted)]">
                    Base pay per day
                  </label>
                  <input
                    type="number"
                    value={defaultBasePayPerDay || ""}
                    onChange={(e) =>
                      setDefaultBasePayPerDay(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <span className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                    In scope: {filteredRows.length} shift(s) &middot;{" "}
                    {selectedUser.trim()
                      ? `filtered: "${selectedUser}"`
                      : `${uniqueEmployees.length || 0} employee(s)`}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleGeneratePayroll}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {loading ? "Generating..." : "Generate payroll summary"}
                </button>
                {payrollData && (
                  <button
                    onClick={handleSavePayroll}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-5 py-3 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save to database"}
                  </button>
                )}
                {error && (
                  <span className="text-sm font-semibold text-red-600">
                    {error}
                  </span>
                )}
                {success && (
                  <span className="text-sm font-semibold text-emerald-600">
                    {success}
                  </span>
                )}
              </div>
            </section>
          </>
        )}

        {selectedTimesheetId && processedTimesheets.length > 0 && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Processed Timesheets
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Timesheets that have been processed for payroll.
            </p>
            <div className="mt-4 flex gap-3 flex-wrap">
              <div>
                <label className="text-sm font-semibold text-[var(--muted)]">
                  Start date
                </label>
                <input
                  type="date"
                  value={processedStartDate}
                  onChange={(e) => setProcessedStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--muted)]">
                  End date
                </label>
                <input
                  type="date"
                  value={processedEndDate}
                  onChange={(e) => setProcessedEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {processedTimesheets.map((ts) => (
                <div
                  key={ts.id}
                  className="rounded-xl border border-[var(--border)] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {ts.startDate} → {ts.endDate}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {ts.employeeCount} employees · {ts.totalRows} rows ·{" "}
                        {ts.format?.toUpperCase() ?? "Unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--muted)]">
                        {ts.payrolls.length} payroll record(s)
                      </p>
                      {ts.payrolls[0] && (
                        <p className="font-semibold text-[var(--accent)]">
                          Total: ${ts.payrolls[0].totalNetPay.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {payrollData && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                  Payroll summary
                </p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {payrollData.startDate} → {payrollData.endDate}
                </h3>
              </div>
              <div className="flex flex-col items-end gap-3 sm:items-end">
                <div className="text-right">
                  <p className="text-sm text-[var(--muted)]">Total net pay</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {formatMoney(totalNetPay)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-sm font-semibold text-[var(--muted)]">
                  {timesheetMeta?.format ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">
                      Source: {timesheetMeta.format.toUpperCase()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Full Days
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Half Days
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Absent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Base Pay/Day
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Base Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Added (+)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Subtracted (-)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Net Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {paginatedPayroll.map((entry) => (
                      <tr
                        key={entry.employeeId}
                        className={`hover:bg-[var(--surface)]/60 ${missingBasePayWarning.includes(entry.employeeId) || entry.basePayPerDay === null ? "bg-red-50" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {entry.isEdited && (
                              <span
                                className="text-lg text-amber-500"
                                title="Edited"
                              >
                                !
                              </span>
                            )}
                            <span className="font-semibold">
                              {entry.employeeName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {entry.attendanceDays}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {entry.halfDays}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {entry.absentDays}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={entry.basePayPerDay ?? ""}
                            onChange={(e) => {
                              const value = e.target.value
                                ? parseFloat(e.target.value)
                                : null;
                              updatePayrollBasePay(entry.employeeId, value);
                            }}
                            placeholder="0.00"
                            className={`w-24 rounded-lg border px-2 py-1 text-sm ${missingBasePayWarning.includes(entry.employeeId) || entry.basePayPerDay === null ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                          {formatMoney(entry.basePay)}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {formatMoney(entry.addedValue)}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {formatMoney(entry.subtractedValue)}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">
                          {formatMoney(entry.netPay)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.isEdited ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                          >
                            {entry.isEdited ? "Edited" : "Generated"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            className="rounded-lg border border-[var(--accent)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <Pagination
                  page={payrollPageSafe}
                  totalPages={payrollTotalPages}
                  onChange={setPayrollPage}
                />
                <span className="text-xs">
                  {payrollData.payroll.length} payroll row(s)
                </span>
              </div>
            </div>
          </section>
        )}

        {savedPayrolls.length > 0 && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                  Saved payrolls
                </p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  From database
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Previously generated and saved payroll records.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Generated
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Entries
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Avg Base Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Total Net
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Edited
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {paginatedSaved.map((payroll) => (
                      <tr
                        key={payroll.id}
                        className="hover:bg-[var(--surface)]/60 cursor-pointer"
                        onClick={() => fetchPayrollDetail(payroll.id)}
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--accent)]">
                          {new Date(payroll.startDate).toLocaleDateString()} –{" "}
                          {new Date(payroll.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {new Date(payroll.generatedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {payroll._count.entries}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {formatMoney(payroll.basePayPerDay)}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">
                          {formatMoney(payroll.totalNetPay)}
                        </td>
                        <td className="px-4 py-3">
                          {payroll.isEdited && (
                            <span
                              className="text-lg text-amber-500"
                              title="Contains edited entries"
                            >
                              !
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <Pagination
                  page={savedPageSafe}
                  totalPages={savedTotalPages}
                  onChange={setSavedPage}
                />
                <span className="text-xs">
                  {savedPayrolls.length} saved payroll(s)
                </span>
              </div>
            </div>
          </section>
        )}

        {selectedPayrollDetail && (
          <section className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                    Payroll Detail
                  </p>
                  <button
                    onClick={() => setSelectedPayrollDetail(null)}
                    className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)] transition hover:border-red-300 hover:text-red-500"
                  >
                    Close
                  </button>
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {selectedPayrollDetail.startDate} → {selectedPayrollDetail.endDate}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Generated: {new Date(selectedPayrollDetail.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 sm:items-end">
                <div className="text-right">
                  <p className="text-sm text-[var(--muted)]">Total net pay</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {formatMoney(selectedPayrollDetail.totalNetPay)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Full Days
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Half Days
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Absent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Base Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Added (+)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Subtracted (-)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Net Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {selectedPayrollDetail.entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-[var(--surface)]/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {entry.isEdited && (
                              <span
                                className="text-lg text-amber-500"
                                title="Edited"
                              >
                                !
                              </span>
                            )}
                            <span className="font-semibold">{entry.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.attendanceDays}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.halfDays}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{entry.absentDays}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                          {formatMoney(entry.basePay)}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {formatMoney(entry.addedValue)}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {formatMoney(entry.subtractedValue)}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">
                          {formatMoney(entry.netPay)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              entry.isEdited
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {entry.isEdited ? "Edited" : "Generated"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditModal({
                                employeeId: entry.employeeId,
                                employeeName: entry.employeeName,
                                attendanceDays: entry.attendanceDays,
                                halfDays: entry.halfDays,
                                absentDays: entry.absentDays,
                                addedValue: entry.addedValue,
                                subtractedValue: entry.subtractedValue,
                                netPay: entry.netPay,
                                basePay: entry.basePay,
                                basePayPerDay: entry.basePay / (entry.attendanceDays + entry.halfDays * 0.5) || null,
                                isEdited: entry.isEdited,
                              });
                              setEditingEntryId(entry.id);
                              setEditingPayrollId(selectedPayrollDetail?.id || null);
                            }}
                            className="rounded-lg border border-[var(--accent)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <span className="text-xs">
                  {selectedPayrollDetail.entries.length} payroll entry(ies)
                </span>
              </div>
            </div>
          </section>
        )}

        {showPayrollConfirm && pendingPayroll ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    Confirm payroll
                  </p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    Generate after review
                  </h3>
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
                  <p className="font-semibold">
                    {startDate} → {endDate}
                  </p>
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
                  <p className="text-[var(--muted)]">
                    Estimated payroll records
                  </p>
                  <p className="font-semibold">
                    {pendingPayroll.aggregated?.length ?? 0}
                  </p>
                </div>
              </div>

              {error && !loading ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
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
                  {loading ? "Generating..." : "Generate payroll"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    Edit payroll entry
                  </p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {editModal.employeeName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Full Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editModal.attendanceDays}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          attendanceDays: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Half Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editModal.halfDays}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          halfDays: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Absent Days
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editModal.absentDays}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          absentDays: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Added (+)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editModal.addedValue || ""}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          addedValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Subtracted (-)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editModal.subtractedValue || ""}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          subtractedValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/50 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--muted)]">Base Pay</p>
                      <p className="font-semibold text-[var(--foreground)]">
                        {formatMoney(
                          editModal.attendanceDays *
                            (editModal.basePayPerDay ?? 0) +
                            editModal.halfDays *
                              (editModal.basePayPerDay ?? 0) *
                              0.5,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Net Pay</p>
                      <p className="font-bold text-xl text-[var(--accent)]">
                        {formatMoney(
                          editModal.attendanceDays *
                            (editModal.basePayPerDay ?? 0) +
                            editModal.halfDays *
                              (editModal.basePayPerDay ?? 0) *
                              0.5 +
                            editModal.addedValue -
                            editModal.subtractedValue,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditModal}
                  className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(47,109,246,0.28)] transition hover:scale-[1.01]"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
