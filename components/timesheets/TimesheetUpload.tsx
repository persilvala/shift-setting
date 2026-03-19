"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedTimesheetRow } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";

type UploadSuccess = {
  ok: true;
  format: "excel" | "pdf" | "manual";
  rows: ParsedTimesheetRow[];
  warnings: string[];
  startDate?: string | null;
  endDate?: string | null;
  timesheetId?: string;
};

type UploadError = { ok: false; error: string };

const PREVIEW_LIMIT = 50;

type ManualRow = {
  id: string;
  employeeName: string;
  date: string;
  totalHours: number | null;
  dept?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  isSoftDeleted?: boolean;
  attendanceStatus?: "full_day" | "half_day" | "absent";
};

type TimesheetPayload = {
  ok: true;
  format: "excel" | "pdf" | "manual";
  rows: ParsedTimesheetRow[];
  warnings: string[];
  startDate?: string | null;
  endDate?: string | null;
  timesheetId?: string;
};

type TimesheetLoadResponse = {
  ok: boolean;
  rows?: ParsedTimesheetRow[];
  timesheet?: { startDate: string; endDate: string; uploadedAt: string; id: string; format?: string } | null;
};

const createBlankManualRow = (): ManualRow => ({
  id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  employeeName: "",
  date: "",
  totalHours: null,
  dept: "",
  timeIn: "",
  timeOut: "",
  isSoftDeleted: false,
  attendanceStatus: "full_day",
});

type EmployeeSummary = { id: string; employeeName: string; dayCount: number };

const mapParsedToManualRow = (row: ParsedTimesheetRow, index: number): ManualRow => ({
  id: (row as any).id ?? `manual-${index}-${row.employeeName}-${row.date ?? ""}`,
  employeeName: row.employeeName ?? "",
  date: row.date ?? "",
  totalHours: row.totalHours ?? row.workHours ?? null,
  dept: row.dept ?? "",
  timeIn: row.timeIn ?? null,
  timeOut: row.timeOut ?? null,
  isSoftDeleted: row.isSoftDeleted ?? false,
  attendanceStatus: row.attendanceStatus ?? "full_day",
});

export function TimesheetUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<TimesheetPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<"upload" | "manual">("upload");
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [manualEmployee, setManualEmployee] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualHours, setManualHours] = useState("");
  const [manualDept, setManualDept] = useState("");
  const [manualEditingId, setManualEditingId] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<string>("");
  const [newEmployeeCounter, setNewEmployeeCounter] = useState(1);
  const [bulkName, setBulkName] = useState("");
  const [bulkDept, setBulkDept] = useState("");
  const [bulkNameUpload, setBulkNameUpload] = useState("");
  const [bulkDeptUpload, setBulkDeptUpload] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Record<string, string[]>>({});
  const [loadingRows, setLoadingRows] = useState(false);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [activeTimesheetId, setActiveTimesheetId] = useState<string | null>(null);

  const hydrateFromServer = (payload: TimesheetPayload) => {
    const rows = payload.rows ?? [];
    setResult(payload);
    setStartDate(payload.startDate ?? null);
    setEndDate(payload.endDate ?? null);
    setManualRows(rows.map(mapParsedToManualRow));
    setActiveTimesheetId(payload.timesheetId ?? null);
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const res = await fetch("/api/timesheets/employee-summary");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setEmployees(data.employees ?? []);
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadEmployeeRows = async (name: string, employeeId?: string | null) => {
    try {
      setLoadingRows(true);
      const params = new URLSearchParams();
      if (employeeId) params.set("employeeId", employeeId);
      else params.set("employeeName", name);
      const response = await fetch(`/api/timesheets/employee-rows?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      if (!data.ok) return;
      const rows = (data.rows ?? []) as ParsedTimesheetRow[];
      if (rows.length) {
        setManualRows(rows.map(mapParsedToManualRow));
      } else {
        const seeded = Array.from({ length: 20 }, () => ({ ...createBlankManualRow(), employeeName: name }));
        setManualRows(seeded);
      }
      setStartDate(data.timesheet?.startDate ?? null);
      setEndDate(data.timesheet?.endDate ?? null);
      setBulkDept(rows[0]?.dept ?? "");
      setBulkName(name);
      setActiveTimesheetId(data.timesheet?.id ?? null);
    } catch (err) {
      console.error("Failed to load employee rows", err);
    } finally {
      setLoadingRows(false);
    }
  };

  const updateTimesheetRows = async (rows: ParsedTimesheetRow[]) => {
    if (!activeTimesheetId) return true;
    try {
      setLoadingRows(true);
      const response = await fetch(`/api/timesheets/${activeTimesheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Failed to save timesheet");
        return false;
      }
      hydrateFromServer(data as TimesheetPayload);
      loadEmployees();
      setPreviewError(null);
      setInvalidFields({});
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save timesheet");
      return false;
    } finally {
      setLoadingRows(false);
    }
  };

  const scrollToRow = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const applyBulkToManualRows = (rows: ManualRow[]) =>
    rows.map((row) =>
      row.employeeName.toLowerCase() === (effectiveEmployee?.toLowerCase?.() ?? "")
        ? {
            ...row,
            employeeName: bulkName?.trim() ? bulkName.trim() : row.employeeName,
            dept: bulkDept ?? row.dept,
          }
        : row
    );

  const addBlankRow = () => {
    if (entryMode === "manual") {
      const scoped = currentEmployee.trim();
      if (!scoped) {
        setError("Select or add an employee first.");
        return;
      }
      const blank = createBlankManualRow();
      blank.employeeName = scoped;
      setManualRows((rows) => {
        const updated = [blank, ...rows];
        return updated;
      });
      setManualMessage("Blank row added. Fill it out, then save.");
      setError(null);
      return;
    }

    setResult((prev) => {
      if (!prev) return prev;
      const blank: ParsedTimesheetRow = {
        employeeName: "",
        date: "",
        timeIn: "",
        timeOut: "",
        totalHours: 0,
        issues: [],
        sourceLine: prev.rows.length + 1,
        dept: "",
        userId: "",
      };
      const nextRows = [blank, ...prev.rows];
      persistUploadRows(nextRows);
      setUploadMessage("Blank row added. Save to keep it.");
      return { ...prev, rows: nextRows };
    });
  };

  const firstManualEmployee = useMemo(() => {
    const named = manualRows.find((row) => row.employeeName?.trim());
    return named?.employeeName?.trim() ?? "";
  }, [manualRows]);

  const effectiveEmployee = useMemo(() => {
    if (currentEmployee.trim()) return currentEmployee.trim();
    if (entryMode === "manual" && firstManualEmployee) return firstManualEmployee;
    return "";
  }, [currentEmployee, entryMode, firstManualEmployee]);

  const previewRows = useMemo(() => {
    if (entryMode === "manual") {
      const scoped = effectiveEmployee.toLowerCase();
      const filtered = scoped ? manualRows.filter((row) => (row.employeeName || "").toLowerCase() === scoped) : [];
      return filtered.slice(0, PREVIEW_LIMIT);
    }
    return (result?.rows ?? []).slice(0, PREVIEW_LIMIT);
  }, [effectiveEmployee, entryMode, manualRows, result]);

  const totalRows = entryMode === "manual"
    ? manualRows.filter((row) => !effectiveEmployee || row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase()).length
    : result?.rows.length ?? 0;

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (entryMode !== "manual") return;

    const dates = manualRows
      .filter((row) => !row.isSoftDeleted)
      .map((row) => new Date(row.date))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (!dates.length) return;
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10);
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10);
    setStartDate(minDate);
    setEndDate(maxDate);
  }, [entryMode, manualRows]);

  useEffect(() => {
    if (entryMode !== "manual") return;
    if (currentEmployee.trim()) return;
    if (!manualRows.length) return;
    const named = manualRows.find((row) => row.employeeName?.trim());
    if (named?.employeeName) {
      setCurrentEmployee(named.employeeName.trim());
    }
  }, [currentEmployee, entryMode, manualRows]);

  useEffect(() => {
    if (!effectiveEmployee) return;
    const matches = manualRows.filter((row) => row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase());
    if (matches.length) {
      setBulkName(effectiveEmployee);
      const firstDept = matches.find((r) => r.dept)?.dept ?? "";
      setBulkDept(firstDept || "");
    }
  }, [effectiveEmployee, manualRows]);

  const handleGeneratePayroll = async () => {
    if (entryMode === "manual") {
      const ok = await persistManualRows(manualRows);
      if (!ok) return;
      router.push("/admin/payroll");
      return;
    }

    if (!result?.rows.length) {
      setError("Upload and parse a timesheet first.");
      return;
    }
    // For upload flow, ensure edits are stored before moving on
    if (activeTimesheetId) {
      const ok = await updateTimesheetRows(result.rows);
      if (!ok) return;
    }
    router.push("/admin/payroll");
  };

  const persistManualRows = async (rows: ManualRow[]) => {
    const activeRows = rows.filter((row) => !row.isSoftDeleted);
    if (!activeRows.length) {
      setError("Add at least one manual row before saving.");
      return false;
    }

    const payloadRows = activeRows.map((row) => {
      const status = row.attendanceStatus ?? "full_day";
      return {
        employeeName: row.employeeName,
        dept: row.dept ?? "",
        date: row.date,
        timeIn: status === "absent" ? null : row.timeIn ?? null,
        timeOut: status === "absent" ? null : row.timeOut ?? null,
        totalHours: status === "absent" ? null : row.totalHours,
        attendanceStatus: status,
      };
    });

    try {
      setLoadingRows(true);
      const url = activeTimesheetId ? `/api/timesheets/${activeTimesheetId}` : "/api/timesheets";
      const method = activeTimesheetId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows }),
      });

      const data = (await response.json()) as TimesheetPayload | UploadError;

      if (!response.ok || !data || ("ok" in data && data.ok === false)) {
        const message = "error" in data ? data.error : "Failed to save manual timesheet";
        setError(message);
        return false;
      }

      hydrateFromServer(data as TimesheetPayload);
      loadEmployees();
      setManualMessage("Manual timesheet saved. Ready to generate payroll.");
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual timesheet");
      return false;
    } finally {
      setLoadingRows(false);
    }
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
      const data = (await response.json()) as TimesheetPayload | UploadError;

      if (!response.ok || !data || ("ok" in data && data.ok === false)) {
        const message = "error" in data ? data.error : "Failed to parse file";
        setError(message);
        return;
      }

      const rows = (data as TimesheetPayload).rows.map((row) => ({
        ...row,
        attendanceStatus: row.attendanceStatus ?? "full_day",
      }));

      hydrateFromServer({ ...(data as TimesheetPayload), rows });
      const dupCheck = flagUploadDuplicates(rows);
      if (dupCheck.hasDuplicates) {
        setPreviewError("Each employee can only have one row per date. Fix duplicates before saving.");
        if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
        if (dupCheck.firstIndex !== undefined) scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
      } else {
        setInvalidFields({});
        setPreviewError(null);
      }
      loadEmployees();
      setEntryMode("upload");
      window.dispatchEvent(new CustomEvent("timesheet-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetManualForm = () => {
    setManualEmployee("");
    setManualDate("");
    setManualHours("");
    setManualDept("");
    setManualEditingId(null);
  };

  const handleManualUpsert = () => {
    setManualMessage(null);
    if (!manualEmployee.trim() || !manualDate.trim()) {
      setError("Employee name and date are required.");
      return;
    }

    const parsedHours = Number(manualHours);
    if (Number.isNaN(parsedHours) || parsedHours < 0) {
      setError("Hours worked must be zero or greater.");
      return;
    }

    const next: ManualRow = {
      id: manualEditingId ?? `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeName: manualEmployee.trim(),
      date: manualDate,
      totalHours: parsedHours,
      dept: manualDept.trim() || null,
      isSoftDeleted: false,
    };

    setManualRows((rows) => {
      const exists = rows.some((row) => row.id === next.id);
      return exists ? rows.map((row) => (row.id === next.id ? { ...row, ...next } : row)) : [...rows, next];
    });
    setError(null);
    setManualMessage(manualEditingId ? "Manual row updated." : "Manual row added.");
    resetManualForm();
  };

  const handleManualEdit = (row: ManualRow) => {
    setEntryMode("manual");
    setManualEmployee(row.employeeName);
    setCurrentEmployee(row.employeeName);
    setManualDate(row.date);
    setManualHours(String(row.totalHours));
    setManualDept(row.dept ?? "");
    setManualEditingId(row.id);
    setManualMessage(null);
  };

  const handleManualDelete = (id: string) => {
    setManualRows((rows) => {
      return rows.filter((row) => row.id !== id);
    });
  };

  const handleManualSoftDelete = (id: string) => {
    setManualRows((rows) => {
      return rows.map((row) => (row.id === id ? { ...row, isSoftDeleted: !row.isSoftDeleted } : row));
    });
  };

  const handleManualSave = async () => {
    setPreviewError(null);
    setInvalidFields({});
    const withBulk = applyBulkToManualRows(manualRows);
    setManualRows(withBulk);
    if (!effectiveEmployee) {
      setPreviewError("Choose an employee before saving their rows.");
      return;
    }

    const active = withBulk.filter(
      (row) =>
        !row.isSoftDeleted &&
        row.employeeName.trim() &&
        row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase()
    );

    const duplicateKeys = new Map<string, number>();
    active.forEach((row) => {
      if (!row.date) return;
      const key = `${row.employeeName.trim().toLowerCase()}|${row.date}`;
      duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
    });

    const invalid = active.filter((row) => {
      const status = row.attendanceStatus ?? "full_day";
      const requiresTime = status !== "absent";
      const missingBase = !row.employeeName.trim() || !row.date || !row.dept;
      const missingTime = requiresTime && (!row.timeIn || !row.timeOut || row.totalHours === null || row.totalHours === undefined);
      return missingBase || missingTime;
    });

    if (invalid.length) {
                        setPreviewError("Add employee, date, time in/out, hours, and department for every row before saving.");
      const invalidMap: Record<string, string[]> = {};
      invalid.forEach((row) => {
        const status = row.attendanceStatus ?? "full_day";
        const requiresTime = status !== "absent";
        invalidMap[row.id] = [
          ...(row.employeeName.trim() ? [] : ["employeeName"]),
          ...(row.date ? [] : ["date"]),
          ...(row.dept ? [] : ["dept"]),
          ...(requiresTime && !row.timeIn ? ["timeIn"] : []),
          ...(requiresTime && !row.timeOut ? ["timeOut"] : []),
          ...(requiresTime && (row.totalHours === null || row.totalHours === undefined) ? ["totalHours"] : []),
        ];
      });
      setInvalidFields(invalidMap);
      const firstIdx = withBulk.findIndex((row) => {
        const status = row.attendanceStatus ?? "full_day";
        const requiresTime = status !== "absent";
        const missingBase = !row.employeeName.trim() || !row.date || !row.dept;
        const missingTime = requiresTime && (row.totalHours === null || row.totalHours === undefined || !row.timeIn || !row.timeOut);
        return !row.isSoftDeleted && row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase() && (missingBase || missingTime);
      });
      if (firstIdx >= 0) {
        const id = `preview-row-${withBulk[firstIdx].id ?? firstIdx}`;
        scrollToRow(id);
      }
      return;
    }

    const duplicateIds = active
      .filter((row) => row.date && (duplicateKeys.get(`${row.employeeName.trim().toLowerCase()}|${row.date}`) ?? 0) > 1)
      .map((row) => row.id);

    if (duplicateIds.length) {
      setPreviewError("Each employee can only have one row per date. Remove duplicates before saving.");
      const invalidMap: Record<string, string[]> = {};
      duplicateIds.forEach((id) => {
        invalidMap[id] = ["date"];
      });
      setInvalidFields(invalidMap);
      const firstDuplicate = withBulk.find((row) => duplicateIds.includes(row.id));
      if (firstDuplicate) {
        scrollToRow(`preview-row-${firstDuplicate.id}`);
      }
      return;
    }

    setInvalidFields({});
    await persistManualRows(withBulk);
  };

  const persistUploadRows = (rows: ParsedTimesheetRow[]) => {
    const active = rows.filter((row) => !row.isSoftDeleted);
    setResult((prev) => (prev ? { ...prev, rows: active } : prev));
  };

  const flagUploadDuplicates = (rows: ParsedTimesheetRow[]) => {
    const activeRows = rows.filter((row) => !row.isSoftDeleted);
    const duplicateKeyCounts = new Map<string, number>();
    activeRows.forEach((row) => {
      if (!row.employeeName?.trim() || !row.date) return;
      const key = `${row.employeeName.trim().toLowerCase()}|${row.date}`;
      duplicateKeyCounts.set(key, (duplicateKeyCounts.get(key) ?? 0) + 1);
    });

    const duplicateIndices: number[] = [];
    rows.forEach((row, i) => {
      if (row.isSoftDeleted || !row.employeeName?.trim() || !row.date) return;
      const key = `${row.employeeName.trim().toLowerCase()}|${row.date}`;
      if ((duplicateKeyCounts.get(key) ?? 0) > 1) duplicateIndices.push(i);
    });

    if (!duplicateIndices.length) return { hasDuplicates: false } as const;

    const invalidMap: Record<string, string[]> = {};
    duplicateIndices.forEach((idxRow) => {
      invalidMap[`upload-${idxRow}`] = ["date"];
    });

    return { hasDuplicates: true, invalidMap, firstIndex: duplicateIndices[0] } as const;
  };

  const employeeList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => set.add(emp.employeeName));
    if (currentEmployee) set.add(currentEmployee);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees, currentEmployee]);


  const ensureEmployeeRows = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter an employee name to load rows.");
      return;
    }
    setError(null);
    setCurrentEmployee(trimmed);
    setManualEmployee(trimmed);
    setBulkName(trimmed);
    setEntryMode("manual");
    setManualRows([]);
    const found = employees.find((emp) => emp.employeeName.toLowerCase() === trimmed.toLowerCase());
    loadEmployeeRows(trimmed, found?.id);
    if (!found) {
      setEmployees((prev) => [...prev, { id: "", employeeName: trimmed, dayCount: 0 }]);
    }
    setManualMessage(`Editing timesheet for ${trimmed}.`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
      <header className="space-y-2">
        <PageHeader>Timesheets</PageHeader>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            {entryMode === "upload" ? "Upload timesheets" : "Add timesheets manually"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {entryMode === "upload"
              ? "Import a file and tidy up rows before saving."
              : "Add and edit rows directly in the table for each employee."}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-1 py-1 text-sm font-semibold w-fit">
            <button
              type="button"
              onClick={() => {
                setEntryMode("upload");
                setUploadMessage(null);
                setPreviewError(null);
              }}
              className={`rounded-full px-3 py-1 transition ${entryMode === "upload" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode("manual");
                setManualMessage(null);
                setPreviewError(null);
              }}
              className={`rounded-full px-3 py-1 transition ${entryMode === "manual" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
            >
              Manual
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Employees</p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Employees from upload or manual entry</h2>
            <p className="text-sm text-[var(--muted)]">Handle up to ~30 employees. Click a row to open their timesheet; “Add employee” drops in starter rows when none exist.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {entryMode === "manual" ? (
              <button
                type="button"
                onClick={() => {
                  const label = `New Employee ${newEmployeeCounter}`;
                  const seeded = Array.from({ length: 20 }, () => ({ ...createBlankManualRow(), employeeName: label }));
                  setManualRows(seeded);
                  setEmployees((prev) => [...prev, { id: "", employeeName: label, dayCount: 0 }]);
                  setCurrentEmployee(label);
                  setManualEmployee(label);
                  setBulkName(label);
                  setBulkDept("");
                  setNewEmployeeCounter((c) => c + 1);
                  setManualMessage(`Created starter rows for ${label}. Name/Dept can be bulk-applied below.`);
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(47,109,246,0.22)] transition hover:scale-[1.01]"
              >
                Add employee
              </button>
            ) : null}
            {manualMessage ? <span className="text-xs font-semibold text-emerald-700">{manualMessage}</span> : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="max-h-72 overflow-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Employee</th>
                    {entryMode === "manual" ? (
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Action</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {loadingEmployees ? (
                    <tr>
                      <td colSpan={entryMode === "manual" ? 2 : 1} className="px-4 py-4 text-center text-[var(--muted)]">Loading employees…</td>
                    </tr>
                  ) : null}
                  {employeeList.length === 0 && !loadingEmployees ? (
                    <tr>
                      <td colSpan={entryMode === "manual" ? 2 : 1} className="px-4 py-4 text-center text-[var(--muted)]">No employees yet. Add one to start a timesheet.</td>
                    </tr>
                  ) : (
                    employeeList.map((name) => {
                      const isActive = effectiveEmployee && effectiveEmployee === name;
                      return (
                         <tr key={name} className={`hover:bg-[var(--surface)]/60 ${isActive ? "bg-[var(--accent)]/5" : ""}`}>
                          <td className="px-4 py-3 font-semibold">{name}</td>
                          {entryMode === "manual" ? (
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => ensureEmployeeRows(name)}
                                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${isActive ? "border-[var(--accent)] text-[var(--accent)] bg-white" : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                              >
                                {isActive ? "Viewing" : "Edit timesheet"}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {entryMode === "upload" && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Upload</p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Upload an Excel, CSV, or PDF</h2>
              <p className="text-sm text-[var(--muted)]">Need Name and Date. Time In/Out and Hours are optional.</p>
            </div>
            <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">Parser ready</span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block cursor-pointer rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/90 px-5 py-5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[var(--foreground)]">Choose a file</p>
                  <p>Grab the timesheet template. Header casing does not matter.</p>
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
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">Hours auto-calc when Time In/Out are set</div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {submitting ? "Parsing…" : "Upload and parse file"}
              </button>
              {error ? <span className="text-sm font-semibold text-red-600">{error}</span> : null}
              {!error && submitting ? <span className="text-sm text-[var(--muted)]">Working on it…</span> : null}
            </div>
          </form>
        </section>
      )}

{false && entryMode === "manual" && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Employees</p>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Manual/Upload employees</h2>
                <p className="text-sm text-[var(--muted)]">Up to ~30 employees. Click a row to open their timesheet; “Add employee” seeds 7 starter rows if none exist.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                    onClick={() => {
                    const label = `New Employee ${newEmployeeCounter}`;
                    const seeded = Array.from({ length: 20 }, () => ({ ...createBlankManualRow(), employeeName: label }));
                    setManualRows(seeded);
                    setEmployees((prev) => [...prev, { id: "", employeeName: label, dayCount: 0 }]);
                    setCurrentEmployee(label);
                    setManualEmployee(label);
                    setBulkName(label);
                    setBulkDept("");
                    setNewEmployeeCounter((c) => c + 1);
                    setManualMessage(`Created starter rows for ${label}. Name/Dept can be bulk-applied below.`);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(47,109,246,0.22)] transition hover:scale-[1.01]"
                >
                  Add employee
                </button>
                {manualMessage ? <span className="text-xs font-semibold text-emerald-700">{manualMessage}</span> : null}
              </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="max-h-72 overflow-auto">
                <table className="min-w-[620px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Employee</th>
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Days</th>
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {employeeList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-[var(--muted)]">No employees yet. Add one to start a timesheet.</td>
                    </tr>
                  ) : (
                    employeeList.map((name) => {
                      const manualMatches = manualRows.filter((r) => r.employeeName === name);
                      const uploadMatches = (result?.rows ?? []).filter((r) => r.employeeName === name);
                      const daySet = new Set<string>();
                      manualMatches.forEach((r) => { if (r.date) daySet.add(r.date); });
                      uploadMatches.forEach((r) => { if (r.date) daySet.add(r.date); });
                      const dayCount = daySet.size;
                      const isActive = effectiveEmployee && effectiveEmployee === name;
                      return (
                        <tr key={name} className={`hover:bg-[var(--surface)]/60 ${isActive ? "bg-[var(--accent)]/5" : ""}`}>
                          <td className="px-4 py-3 font-semibold">{name}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{dayCount || "—"}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => ensureEmployeeRows(name)}
                              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${isActive ? "border-[var(--accent)] text-[var(--accent)] bg-white" : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                            >
                              {isActive ? "Viewing" : "Edit timesheet"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {effectiveEmployee ? null : (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center text-sm text-[var(--muted)]">
              <p className="text-base font-semibold text-[var(--foreground)]">Pick or add an employee to edit their rows.</p>
            </div>
          )}
        </section>
      )}

      {(entryMode === "upload" ? result : true) ? (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Preview</p>
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">Showing the first {Math.min(PREVIEW_LIMIT, totalRows)} rows</h3>
                    <p className="text-sm text-[var(--muted)]">Review, edit, or delete rows before payroll runs.</p>
                    {loadingRows ? <p className="text-xs font-semibold text-[var(--accent)]">Loading timesheet rows…</p> : null}
                  </div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">Total rows: {totalRows}</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">Source: {entryMode === "upload" ? (result?.format?.toUpperCase() ?? "UPLOAD") : "MANUAL"}</span>
                {(startDate || endDate) && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 text-[var(--accent)]">
                    Period: {startDate ?? "—"} to {endDate ?? "—"}
                  </span>
                )}
                {entryMode === "upload" && uploadMessage ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[var(--muted)]">{uploadMessage}</span>
                ) : null}
                {entryMode === "manual" ? (
                  <button
                    type="button"
                    onClick={addBlankRow}
                    className="ml-auto inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:scale-[1.01]"
                  >
                    + Add row
                  </button>
                ) : null}
                {entryMode === "upload" ? null : null}
              </div>
            </div>

            {entryMode === "manual" && effectiveEmployee ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">Employee name (applies to all rows)</label>
                  <input
                    value={bulkName}
                    onChange={(e) => setBulkName(e.target.value)}
                    onBlur={() => {
                      if (!bulkName.trim()) return;
                      setManualRows((rows) =>
                        rows.map((r) =>
                          r.employeeName.toLowerCase() === effectiveEmployee.toLowerCase()
                            ? { ...r, employeeName: bulkName.trim() }
                            : r
                        )
                      );
                      setCurrentEmployee(bulkName.trim());
                      setManualEmployee(bulkName.trim());
                    }}
                    placeholder="Employee name"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">Department (applies to all rows)</label>
                  <input
                    value={bulkDept}
                    onChange={(e) => setBulkDept(e.target.value)}
                    onBlur={() => {
                      setManualRows((rows) =>
                        rows.map((r) =>
                          r.employeeName.toLowerCase() === effectiveEmployee.toLowerCase()
                            ? { ...r, dept: bulkDept }
                            : r
                        )
                      );
                    }}
                    placeholder="Department"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}

            {entryMode === "upload" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">Employee name (applies to all rows)</label>
                  <input
                    value={bulkNameUpload}
                    onChange={(e) => setBulkNameUpload(e.target.value)}
                    onBlur={() => {
                      if (!result || !bulkNameUpload.trim()) return;
                      const nextRows = result.rows.map((r) => ({ ...r, employeeName: bulkNameUpload.trim() }));
                      setResult({ ...result, rows: nextRows });
                    }}
                    placeholder="Employee name"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">Department (applies to all rows)</label>
                  <input
                    value={bulkDeptUpload}
                    onChange={(e) => setBulkDeptUpload(e.target.value)}
                    onBlur={() => {
                      if (!result) return;
                      const nextRows = result.rows.map((r) => ({ ...r, dept: bulkDeptUpload }));
                      setResult({ ...result, rows: nextRows });
                    }}
                    placeholder="Department"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}

            {previewError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{previewError}</div>
            ) : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Name</th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Date</th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Time In</th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Time Out</th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Hours</th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Dept</th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Status</th>
                    <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                   {previewRows.length === 0 ? (
                     <tr>
                       <td colSpan={9} className="px-4 py-6 text-center text-[var(--muted)]">No rows yet. Click “+ Add row” or upload a timesheet to get started.</td>
                     </tr>
                   ) : (
                       previewRows.map((row, idx) => {
                      const isManual = (row as ManualRow).id !== undefined;
                      const baseKey = isManual ? (row as ManualRow).id : `upload-${idx}`;
                      const attendanceStatus = (row as ParsedTimesheetRow).attendanceStatus ?? (row as ManualRow).attendanceStatus ?? "full_day";
                      const isAbsent = attendanceStatus === "absent";
                      const isEdited = row.isSoftDeleted; // Use for status display

                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case "full_day":
                            return "bg-emerald-100 text-emerald-700";
                          case "half_day":
                            return "bg-amber-100 text-amber-700";
                          case "absent":
                            return "bg-red-100 text-red-700";
                          default:
                            return "bg-gray-100 text-gray-700";
                        }
                      };

                      const getStatusLabel = (status: string) => {
                        switch (status) {
                          case "full_day":
                            return "Full";
                          case "half_day":
                            return "Half";
                          case "absent":
                            return "Absent";
                          default:
                            return "Unknown";
                        }
                      };
                      const name = (row as ParsedTimesheetRow).employeeName ?? (row as ManualRow).employeeName;
                      const date = (row as ParsedTimesheetRow).date ?? (row as ManualRow).date;
                      const rawHours = (row as ParsedTimesheetRow).totalHours ?? (row as ManualRow).totalHours;
                      const dept = (row as ParsedTimesheetRow).dept ?? (row as ManualRow).dept ?? "";
                      const timeIn = isAbsent ? "" : (row as ParsedTimesheetRow).timeIn ?? (row as ManualRow).timeIn ?? "";
                      const timeOut = isAbsent ? "" : (row as ParsedTimesheetRow).timeOut ?? (row as ManualRow).timeOut ?? "";
                      const displayHours = isAbsent ? "" : rawHours ?? "";

                      const updateRow = (field: "employeeName" | "date" | "totalHours" | "dept" | "timeIn" | "timeOut", value: string) => {
                        if (isAbsent && (field === "timeIn" || field === "timeOut" || field === "totalHours")) return;
                        if (entryMode === "manual") {
                          setManualRows((rows) => {
                            const updated = rows.map((r) =>
                              (r as ManualRow).id === baseKey
                                ? {
                                    ...r,
                                    [field]: field === "totalHours" ? (value === "" ? null : Number(value) || 0) : value,
                                  }
                                : r
                            );
                            return updated;
                          });
                        } else {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const nextRows = [...prev.rows];
                            const nextRow = {
                              ...nextRows[idx],
                              [field]: field === "totalHours" ? Number(value) || 0 : value,
                            };

                            if (field === "employeeName") {
                              const currentDept = nextRow.dept ?? "";
                              if (!currentDept.trim()) {
                                nextRow.dept = value;
                              }
                            }

                            nextRows[idx] = nextRow;
                            persistUploadRows(nextRows);
                            return { ...prev, rows: nextRows };
                          });
                        }
                      };

                      const removeRow = () => {
                        const proceed = typeof window === "undefined"
                          ? true
                          : window.confirm(`Delete this row${name ? ` for ${name}` : ""}${date ? ` on ${date}` : ""}? This cannot be undone.`);
                        if (!proceed) return;
                        if (entryMode === "manual") {
                          handleManualDelete(baseKey);
                        } else {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const nextRows = prev.rows.filter((_, i) => i !== idx);
                            persistUploadRows(nextRows);
                            setError(null);
                            return { ...prev, rows: nextRows };
                          });
                        }
                      };

                      const toggleSoftDelete = () => {
                        if (entryMode === "manual") {
                          handleManualSoftDelete(baseKey);
                        } else {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const nextRows = prev.rows.map((rowItem, i) =>
                              i === idx ? { ...rowItem, isSoftDeleted: !rowItem.isSoftDeleted } : rowItem
                            );
                            persistUploadRows(nextRows);
                            setUploadMessage(nextRows[idx].isSoftDeleted ? "Row soft deleted" : "Row restored");
                            return { ...prev, rows: nextRows };
                          });
                        }
                      };

                      return (
                        <tr
                          key={baseKey}
                          id={isManual ? `preview-row-${baseKey}` : `preview-row-upload-${idx}`}
                          className={`hover:bg-[var(--surface)]/60 ${row.isSoftDeleted ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              value={entryMode === "manual" ? bulkName || name || "" : name || ""}
                              onChange={(e) => updateRow("employeeName", e.target.value)}
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("employeeName") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={entryMode === "manual"}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={date ?? ""}
                              onChange={(e) => updateRow("date", e.target.value)}
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("date") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={timeIn}
                              onChange={(e) => updateRow("timeIn", e.target.value)}
                              placeholder="09:00"
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("timeIn") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={isAbsent}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={timeOut}
                              onChange={(e) => updateRow("timeOut", e.target.value)}
                              placeholder="18:00"
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("timeOut") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={isAbsent}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={displayHours}
                              onChange={(e) => updateRow("totalHours", e.target.value)}
                              step="0.01"
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("totalHours") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={isAbsent}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={entryMode === "manual" ? bulkDept || dept || "" : dept}
                              onChange={(e) => updateRow("dept", e.target.value)}
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("dept") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={entryMode === "manual"}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={row.isSoftDeleted ? "deleted" : attendanceStatus}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                if (newStatus === "deleted") {
                                  toggleSoftDelete();
                                } else {
                                  if (entryMode === "manual") {
                                    setManualRows((rows) => {
                                      const updated = rows.map((r) =>
                                        (r as ManualRow).id === baseKey
                                          ? {
                                              ...r,
                                              attendanceStatus: newStatus as "full_day" | "half_day" | "absent",
                                              isSoftDeleted: false,
                                              timeIn: newStatus === "absent" ? null : r.timeIn,
                                              timeOut: newStatus === "absent" ? null : r.timeOut,
                                              totalHours: newStatus === "absent" ? null : r.totalHours,
                                            }
                                          : r
                                      );
                                      return updated;
                                    });
                                  } else {
                                    setResult((prev) => {
                                      if (!prev) return prev;
                                      const nextRows = [...prev.rows];
                                      nextRows[idx] = {
                                        ...nextRows[idx],
                                        attendanceStatus: newStatus as "full_day" | "half_day" | "absent",
                                        isSoftDeleted: false,
                                        timeIn: newStatus === "absent" ? null : nextRows[idx].timeIn,
                                        timeOut: newStatus === "absent" ? null : nextRows[idx].timeOut,
                                        totalHours: newStatus === "absent" ? null : nextRows[idx].totalHours,
                                      };
                                      persistUploadRows(nextRows);
                                      return { ...prev, rows: nextRows };
                                    });
                                  }
                                }
                              }}
                              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${row.isSoftDeleted ? "border-red-200 bg-red-50 text-red-700" : getStatusColor(attendanceStatus)}`}
                            >
                              <option value="full_day">Full Day</option>
                              <option value="half_day">Half Day</option>
                              <option value="absent">Absent</option>
                              {row.isSoftDeleted && <option value="deleted">Deleted</option>}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={removeRow}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <div className="flex flex-wrap gap-2">
                  {entryMode === "manual" ? (
                    <>
                      <button
                        type="button"
                        onClick={handleManualSave}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(47,109,246,0.2)] hover:scale-[1.01]"
                      >
                        Save
                      </button>
                      {manualMessage ? <span className="text-xs font-semibold text-emerald-700">{manualMessage}</span> : null}
                    </>
                  ) : (
                    <>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!result) return;
                        setPreviewError(null);
                        setInvalidFields({});
                        const activeRows = result.rows.filter((row) => !row.isSoftDeleted);
                        const invalid = activeRows.filter((row) => {
                          const status = row.attendanceStatus ?? "full_day";
                          const requiresTime = status !== "absent";
                          const missingBase = !row.employeeName?.trim() || !row.date || !row.dept;
                          const missingTime = requiresTime && (!row.timeIn || !row.timeOut || row.totalHours === null || row.totalHours === undefined);
                          return missingBase || missingTime;
                        });
                        if (invalid.length) {
                          setPreviewError("Add employee, date, time in/out, hours, and department for every row before saving.");
                          const invalidMap: Record<string, string[]> = {};
                          invalid.forEach((row) => {
                            const idxRow = result.rows.indexOf(row);
                            const key = `upload-${idxRow}`;
                            invalidMap[key] = [
                              ...(row.employeeName?.trim() ? [] : ["employeeName"]),
                              ...(row.date ? [] : ["date"]),
                              ...(row.dept ? [] : ["dept"]),
                              ...((row.attendanceStatus ?? "full_day") !== "absent" && !row.timeIn ? ["timeIn"] : []),
                              ...((row.attendanceStatus ?? "full_day") !== "absent" && !row.timeOut ? ["timeOut"] : []),
                              ...((row.attendanceStatus ?? "full_day") !== "absent" && (row.totalHours === null || row.totalHours === undefined) ? ["totalHours"] : []),
                            ];
                          });
                          setInvalidFields(invalidMap);
                          const idx = result.rows.findIndex(
                            (row) =>
                              !row.employeeName?.trim() ||
                              !row.date ||
                              !row.dept ||
                              ((row.attendanceStatus ?? "full_day") !== "absent" && (row.totalHours === null || row.totalHours === undefined || !row.timeIn || !row.timeOut))
                          );
                          if (idx >= 0) {
                            scrollToRow(`preview-row-upload-${idx}`);
                          }
                          return;
                        }

                        const dupCheck = flagUploadDuplicates(result.rows);
                        if (dupCheck.hasDuplicates) {
                          setPreviewError("Each employee can only have one row per date. Fix duplicates before saving.");
                          if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
                          if (dupCheck.firstIndex !== undefined) scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
                          return;
                        }

                        setInvalidFields({});
                        const ok = await updateTimesheetRows(result.rows);
                        if (ok) {
                          setUploadMessage("Upload rows saved.");
                        }
                      }}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(47,109,246,0.2)] hover:scale-[1.01]"
                      >
                        Save
                      </button>
                      {uploadMessage ? <span className="text-xs font-semibold text-emerald-700">{uploadMessage}</span> : null}
                    </>
                  )}
                </div>
                <span className="text-xs">Showing {Math.min(PREVIEW_LIMIT, totalRows)} of {totalRows} row(s)</span>
              </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
            <p className="text-base font-semibold text-[var(--foreground)]">No rows yet</p>
            <p className="mt-1">Upload a file or switch to Manual to start adding rows.</p>
          </div>
        </section>
      )}
    </main>
  );
}
