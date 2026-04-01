/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedTimesheetRow, TimesheetMeta } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import {
  parseExcelFileClient,
  parseCsvFileClient,
  type ClientParseResult,
} from "@/lib/clientParser";

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
  employeeId?: number | null;
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
  timesheetId?: number | null;
  fileName?: string | null;
  mergedFromDatabaseCount?: number;
};

type TimesheetLoadResponse = {
  ok: boolean;
  rows?: ParsedTimesheetRow[];
  timesheet?: {
    startDate: string;
    endDate: string;
    uploadedAt: string;
    id: string;
    format?: string;
  } | null;
};

type TimesheetHistoryItem = {
  id: number;
  startDate: string;
  endDate: string;
  uploadedAt: string;
  rowCount: number;
  rows: ParsedTimesheetRow[];
};

type HistoryPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

const parseDateInput = (value: string): Date | null => {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

type EmployeeSummary = { id: number; employeeName: string; dayCount: number };

type DiffSummary = {
  added: number;
  edited: number;
  deleted: number;
};

type RowSnapshot = {
  key: string;
  dbId: number | null;
  employeeName: string;
  employeeId: number | null;
  date: string;
  totalHours: number | null;
  dept: string;
  timeIn: string;
  timeOut: string;
  attendanceStatus: "full_day" | "half_day" | "absent";
  isSoftDeleted: boolean;
};

type SaveConfirmState = {
  open: boolean;
  mode: "manual" | "upload" | null;
  summary: DiffSummary;
};

type DeletedRowPayload = {
  id?: number;
  employeeName: string;
  employeeId?: number | null;
  date: string;
};

const createUploadRowKey = () =>
  `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ensureUploadRowKey = (row: ParsedTimesheetRow): ParsedTimesheetRow => {
  const existingKey = (row as any).__rowKey;
  if (existingKey) return row;
  return { ...(row as any), __rowKey: createUploadRowKey() };
};

const ensureUploadRowKeys = (rows: ParsedTimesheetRow[]) =>
  rows.map((row) => ensureUploadRowKey(row));

const getUploadRowKey = (row: ParsedTimesheetRow, index: number) =>
  ((row as any).__rowKey as string | undefined) ??
  `upload-${index}-${row.employeeName ?? ""}-${row.date ?? ""}`;

const createManualRowSnapshot = (row: ManualRow): RowSnapshot => ({
  key: String(row.id),
  dbId: typeof row.id === "number" ? row.id : null,
  employeeName: row.employeeName?.trim() ?? "",
  employeeId: row.employeeId ?? null,
  date: row.date ?? "",
  totalHours: row.totalHours ?? null,
  dept: row.dept ?? "",
  timeIn: row.timeIn ?? "",
  timeOut: row.timeOut ?? "",
  attendanceStatus: row.attendanceStatus ?? "full_day",
  isSoftDeleted: row.isSoftDeleted ?? false,
});

const createUploadRowSnapshot = (
  row: ParsedTimesheetRow,
  index: number,
): RowSnapshot => ({
  key: getUploadRowKey(row, index),
  dbId: typeof row.id === "number" ? row.id : null,
  employeeName: row.employeeName?.trim() ?? "",
  employeeId: (row as any).employeeId ?? null,
  date: row.date ?? "",
  totalHours: row.totalHours ?? null,
  dept: row.dept ?? "",
  timeIn: row.timeIn ?? "",
  timeOut: row.timeOut ?? "",
  attendanceStatus: row.attendanceStatus ?? "full_day",
  isSoftDeleted: row.isSoftDeleted ?? false,
});

const snapshotToManualRow = (snapshot: RowSnapshot): ManualRow => ({
  id: snapshot.dbId ?? snapshot.key,
  employeeName: snapshot.employeeName,
  employeeId: snapshot.employeeId,
  date: snapshot.date,
  totalHours: snapshot.totalHours,
  dept: snapshot.dept,
  timeIn: snapshot.timeIn,
  timeOut: snapshot.timeOut,
  attendanceStatus: snapshot.attendanceStatus,
  isSoftDeleted: false,
});

const snapshotToUploadRow = (snapshot: RowSnapshot): ParsedTimesheetRow =>
  ensureUploadRowKey({
    id: snapshot.dbId ?? undefined,
    employeeName: snapshot.employeeName,
    employeeId: snapshot.employeeId ?? undefined,
    date: snapshot.date,
    totalHours: snapshot.totalHours,
    dept: snapshot.dept,
    timeIn: snapshot.timeIn,
    timeOut: snapshot.timeOut,
    attendanceStatus: snapshot.attendanceStatus,
    isSoftDeleted: false,
    issues: [],
    sourceLine: 0,
  } as ParsedTimesheetRow);

const snapshotsEqual = (a: RowSnapshot, b: RowSnapshot) =>
  a.employeeName === b.employeeName &&
  a.employeeId === b.employeeId &&
  a.date === b.date &&
  a.totalHours === b.totalHours &&
  a.dept === b.dept &&
  a.timeIn === b.timeIn &&
  a.timeOut === b.timeOut &&
  a.attendanceStatus === b.attendanceStatus &&
  a.isSoftDeleted === b.isSoftDeleted;

const computeDiffSummary = (
  baseline: RowSnapshot[],
  current: RowSnapshot[],
): DiffSummary => {
  const baselineMap = new Map(baseline.map((row) => [row.key, row]));
  const currentMap = new Map(current.map((row) => [row.key, row]));

  let added = 0;
  let edited = 0;
  let deleted = 0;

  current.forEach((row) => {
    const previous = baselineMap.get(row.key);
    if (!previous) {
      if (!row.isSoftDeleted) added += 1;
      return;
    }
    if (!previous.isSoftDeleted && row.isSoftDeleted) {
      deleted += 1;
      return;
    }
    if (previous.isSoftDeleted && !row.isSoftDeleted) {
      edited += 1;
      return;
    }
    if (!snapshotsEqual(previous, row)) edited += 1;
  });

  baseline.forEach((row) => {
    if (!currentMap.has(row.key) && !row.isSoftDeleted) {
      deleted += 1;
    }
  });

  return { added, edited, deleted };
};

const getDeletedRowPayloads = (
  baseline: RowSnapshot[],
  current: RowSnapshot[],
): DeletedRowPayload[] => {
  const currentMap = new Map(current.map((row) => [row.key, row]));
  const deleted = baseline.filter((row) => {
    if (row.isSoftDeleted) return false;
    const currentRow = currentMap.get(row.key);
    return !currentRow || currentRow.isSoftDeleted;
  });

  return deleted.map((row) => ({
    ...(row.dbId ? { id: row.dbId } : {}),
    employeeName: row.employeeName,
    employeeId: row.employeeId,
    date: row.date,
  }));
};

const mapParsedToManualRow = (
  row: ParsedTimesheetRow,
  index: number,
): ManualRow => ({
  id:
    (row as any).id ?? `manual-${index}-${row.employeeName}-${row.date ?? ""}`,
  employeeName: row.employeeName ?? "",
  employeeId: (row as any).employeeId ?? null,
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
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
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
  const [invalidFields, setInvalidFields] = useState<Record<string, string[]>>(
    {},
  );
  const [loadingRows, setLoadingRows] = useState(false);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [activeTimesheetId, setActiveTimesheetId] = useState<number | null>(
    null,
  );
  const [timesheetHistory, setTimesheetHistory] = useState<
    TimesheetHistoryItem[]
  >([]);
  const [historyPagination, setHistoryPagination] = useState<HistoryPagination>(
    { page: 1, limit: 5, total: 0, totalPages: 1 },
  );
  const [selectedTimesheetId, setSelectedTimesheetId] = useState<number | null>(
    null,
  );
  const [manualBaselineRows, setManualBaselineRows] = useState<RowSnapshot[]>([]);
  const [uploadBaselineRows, setUploadBaselineRows] = useState<RowSnapshot[]>([]);
  const [selectedManualRowKeys, setSelectedManualRowKeys] = useState<string[]>([]);
  const [selectedUploadRowKeys, setSelectedUploadRowKeys] = useState<string[]>([]);
  const [showAddEmployeeDialog, setShowAddEmployeeDialog] = useState(false);
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);
  const [addEmployeeName, setAddEmployeeName] = useState("");
  const [addEmployeeSeedMode, setAddEmployeeSeedMode] = useState<
    "single" | "range"
  >("single");
  const [addEmployeeSingleDate, setAddEmployeeSingleDate] = useState("");
  const [saveConfirmState, setSaveConfirmState] = useState<SaveConfirmState>({
    open: false,
    mode: null,
    summary: { added: 0, edited: 0, deleted: 0 },
  });

  const hydrateFromServer = (payload: TimesheetPayload) => {
    const rows = ensureUploadRowKeys(payload.rows ?? []);
    setResult({ ...payload, rows });
    setStartDate(payload.startDate ?? null);
    setEndDate(payload.endDate ?? null);
    if (payload.format === "manual" || entryMode === "manual") {
      const nextManualRows = rows.map(mapParsedToManualRow);
      setManualRows(nextManualRows);
      setManualBaselineRows(nextManualRows.map(createManualRowSnapshot));
    }
    setUploadBaselineRows(rows.map(createUploadRowSnapshot));
    const tsId =
      payload.timesheetId !== undefined && payload.timesheetId !== null
        ? Number(payload.timesheetId)
        : null;
    setActiveTimesheetId(Number.isFinite(tsId as number) ? tsId : null);
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

  const filterRowsForEmployee = (rows: ParsedTimesheetRow[], name: string) => {
    const scoped = name.trim().toLowerCase();
    return rows.filter(
      (row) => (row.employeeName ?? "").toLowerCase() === scoped,
    );
  };

  const loadEmployeeRows = async (
    name: string,
    employeeId?: number | null,
    page = 1,
  ) => {
    try {
      setLoadingRows(true);
      const params = new URLSearchParams();
      if (employeeId !== undefined && employeeId !== null)
        params.set("employeeId", String(employeeId));
      else params.set("employeeName", name);
      params.set("page", page.toString());
      params.set("limit", "5");
      const response = await fetch(
        `/api/timesheets/employee-rows?${params.toString()}`,
      );
      if (!response.ok) return;
      const data = await response.json();
      if (!data.ok) return;

      const timesheets = (data.timesheets ?? []) as TimesheetHistoryItem[];
      const pagination = data.pagination as HistoryPagination;

      const scopedTimesheets = timesheets.map((t) => ({
        ...t,
        rows: filterRowsForEmployee(t.rows, name),
      }));

      setTimesheetHistory(scopedTimesheets);
      setHistoryPagination(pagination);

      if (scopedTimesheets.length > 0) {
        const firstTimesheet = scopedTimesheets[0];
        if (
          !selectedTimesheetId ||
          !scopedTimesheets.find((t) => t.id === selectedTimesheetId)
        ) {
          setSelectedTimesheetId(firstTimesheet.id);
        }
        const selected =
          scopedTimesheets.find((t) => t.id === selectedTimesheetId) ??
          scopedTimesheets[0];
        const nextManualRows = filterRowsForEmployee(selected.rows, name).map(
          mapParsedToManualRow,
        );
        setManualRows(nextManualRows);
        setManualBaselineRows(nextManualRows.map(createManualRowSnapshot));
        setStartDate(selected.startDate ?? null);
        setEndDate(selected.endDate ?? null);
        setBulkDept(selected.rows[0]?.dept ?? "");
        setBulkName(name);
        setActiveTimesheetId(selected.id);
      } else {
        const seeded = Array.from({ length: 20 }, () => ({
          ...createBlankManualRow(),
          employeeName: name,
        }));
        setManualRows(seeded);
        setManualBaselineRows([]);
        setStartDate(null);
        setEndDate(null);
        setBulkDept("");
        setBulkName(name);
        setActiveTimesheetId(null);
      }
    } catch (err) {
      console.error("Failed to load employee rows", err);
    } finally {
      setLoadingRows(false);
    }
  };

  const selectTimesheet = (timesheetId: number) => {
    setSelectedTimesheetId(timesheetId);
    const timesheet = timesheetHistory.find((t) => t.id === timesheetId);
    if (timesheet) {
      const scopedRows = filterRowsForEmployee(
        timesheet.rows,
        effectiveEmployee || timesheet.rows[0]?.employeeName || "",
      );
      const nextManualRows = scopedRows.map(mapParsedToManualRow);
      setManualRows(nextManualRows);
      setManualBaselineRows(nextManualRows.map(createManualRowSnapshot));
      setStartDate(timesheet.startDate ?? null);
      setEndDate(timesheet.endDate ?? null);
      setActiveTimesheetId(timesheetId);
    }
  };

  const handleHistoryPageChange = (newPage: number) => {
    if (newPage < 1 || newPage > historyPagination.totalPages) return;
    setHistoryPagination((prev) => ({ ...prev, page: newPage }));
    loadEmployeeRows(effectiveEmployee, undefined, newPage);
  };

  const updateTimesheetRows = async (
    rows: ParsedTimesheetRow[],
    deletedRows: DeletedRowPayload[] = [],
  ) => {
    if (!activeTimesheetId) return true;
    try {
      setLoadingRows(true);
      const response = await fetch(`/api/timesheets/${activeTimesheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, deletedRows }),
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

  const saveUploadRows = async (
    rows: ParsedTimesheetRow[],
    deletedRows: DeletedRowPayload[] = [],
  ) => {
    try {
      setLoadingRows(true);

      if (!validateUploadPreview(rows)) {
        return false;
      }

      const payloadRows = rows.map((row) => ({
        id: typeof row.id === "number" ? row.id : undefined,
        employeeName: row.employeeName,
        dept: row.dept ?? "",
        date: row.date,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        totalHours: row.totalHours,
        attendanceStatus: row.attendanceStatus ?? "full_day",
      }));

      const response = await fetch("/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: payloadRows,
          deletedRows,
          fileName: result?.timesheetId
            ? (result.fileName ?? "upload")
            : result?.format
              ? `${result.format}-upload`
              : "upload",
          format: result?.format ?? "excel",
          entrySource: "upload",
        }),
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
      row.employeeName.toLowerCase() ===
      (effectiveEmployee?.toLowerCase?.() ?? "")
        ? {
            ...row,
            employeeName: bulkName?.trim() ? bulkName.trim() : row.employeeName,
            dept: bulkDept ?? row.dept,
          }
        : row,
    );

  const addDateRangeRows = () => {
    setPreviewError(null);
    setInvalidFields({});

    if (!rangeStart || !rangeEnd) {
      setPreviewError("Choose a start and end date to add rows.");
      return;
    }

    const start = parseDateInput(rangeStart);
    const end = parseDateInput(rangeEnd);
    if (!start || !end) {
      setPreviewError("Use valid calendar dates.");
      return;
    }

    if (start.getTime() > end.getTime()) {
      setPreviewError("Start date must be on or before end date.");
      return;
    }

    const totalDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const RANGE_LIMIT = 90;
    if (totalDays > RANGE_LIMIT) {
      setPreviewError(`Choose a range of ${RANGE_LIMIT} days or fewer.`);
      return;
    }

    if (entryMode === "manual") {
      const scoped = effectiveEmployee.trim();
      if (!scoped) {
        setPreviewError("Select or add an employee before adding dates.");
        return;
      }

      let added = 0;
      setManualRows((rows) => {
        const existingDates = new Set(
          rows
            .filter(
              (row) => row.employeeName.toLowerCase() === scoped.toLowerCase(),
            )
            .map((row) => row.date),
        );

        const additions: ManualRow[] = [];
        const cursor = new Date(start);
        while (cursor.getTime() <= end.getTime()) {
          const dateStr = cursor.toISOString().slice(0, 10);
          if (!existingDates.has(dateStr)) {
            const base = createBlankManualRow();
            additions.push({
              ...base,
              employeeName: scoped,
              date: dateStr,
              dept: bulkDept ?? base.dept,
            });
            existingDates.add(dateStr);
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        added = additions.length;
        if (!added) return rows;
        return [...additions, ...rows];
      });

      const skipped = totalDays - added;
      if (added === 0) {
        setManualMessage(
          "No new dates added; all dates already exist for this employee.",
        );
      } else {
        setManualMessage(
          `Added ${added} date${added === 1 ? "" : "s"} for ${scoped}${skipped > 0 ? ` (${skipped} already existed)` : ""}.`,
        );
      }

      setRangeStart("");
      setRangeEnd("");
      setShowDateRangeDialog(false);
      return;
    }

    const baseResult: TimesheetPayload = result ?? {
      ok: true,
      format: "excel",
      rows: [],
      warnings: [],
      startDate: null,
      endDate: null,
      timesheetId: null,
      fileName: null,
      mergedFromDatabaseCount: 0,
    };

    const existingDates = new Set(
      (baseResult.rows ?? []).map((row) => row.date).filter(Boolean),
    );
    const additions: ParsedTimesheetRow[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (!existingDates.has(dateStr)) {
        additions.push({
          employeeName: "",
          date: dateStr,
          timeIn: "",
          timeOut: "",
          totalHours: 0,
          issues: [],
          sourceLine: (baseResult.rows?.length ?? 0) + additions.length + 1,
          dept: "",
          userId: "",
          attendanceStatus: "full_day",
          isSoftDeleted: false,
        });
        existingDates.add(dateStr);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const added = additions.length;
    const skipped = totalDays - added;
    if (added === 0) {
      setUploadMessage(
        "No new dates added; all dates already exist in preview.",
      );
      setRangeStart("");
      setRangeEnd("");
      if (!result) setResult(baseResult);
      return;
    }

    const nextRows = ensureUploadRowKeys([...additions, ...baseResult.rows]);
    const validDates = nextRows
      .map((row) => parseDateInput(row.date ?? ""))
      .filter((d): d is Date => Boolean(d));
    const nextStart = validDates.length
      ? new Date(Math.min(...validDates.map((d) => d.getTime())))
          .toISOString()
          .slice(0, 10)
      : (baseResult.startDate ?? null);
    const nextEnd = validDates.length
      ? new Date(Math.max(...validDates.map((d) => d.getTime())))
          .toISOString()
          .slice(0, 10)
      : (baseResult.endDate ?? null);

    setResult({
      ...baseResult,
      rows: nextRows,
      startDate: nextStart,
      endDate: nextEnd,
    });
    if (nextStart) setStartDate(nextStart);
    if (nextEnd) setEndDate(nextEnd);

    setUploadMessage(
      `Added ${added} date${added === 1 ? "" : "s"} to upload preview${skipped > 0 ? ` (${skipped} already existed)` : ""}.`,
    );
    setRangeStart("");
    setRangeEnd("");
    setShowDateRangeDialog(false);
  };

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
      const base: TimesheetPayload = prev ?? {
        ok: true,
        format: "excel",
        rows: [],
        warnings: [],
        startDate: null,
        endDate: null,
        timesheetId: null,
        fileName: null,
        mergedFromDatabaseCount: 0,
      };
      const blank: ParsedTimesheetRow = {
        employeeName: "",
        date: "",
        timeIn: "",
        timeOut: "",
        totalHours: 0,
        issues: [],
        sourceLine: (base.rows?.length ?? 0) + 1,
        dept: "",
        userId: "",
        attendanceStatus: "full_day",
        isSoftDeleted: false,
      };
      const nextRows = ensureUploadRowKeys([blank, ...(base.rows ?? [])]);
      persistUploadRows(nextRows);
      setUploadMessage("Blank row added. Save to keep it.");
      return { ...base, rows: nextRows };
    });
  };

  const firstManualEmployee = useMemo(() => {
    const named = manualRows.find((row) => row.employeeName?.trim());
    return named?.employeeName?.trim() ?? "";
  }, [manualRows]);

  const effectiveEmployee = useMemo(() => {
    if (currentEmployee.trim()) return currentEmployee.trim();
    if (entryMode === "manual" && firstManualEmployee)
      return firstManualEmployee;
    return "";
  }, [currentEmployee, entryMode, firstManualEmployee]);

  const previewRows = useMemo(() => {
    if (entryMode === "manual") {
      const scoped = effectiveEmployee.toLowerCase();
      const filtered = scoped
        ? manualRows.filter(
            (row) => (row.employeeName || "").toLowerCase() === scoped,
          )
        : [];
      return filtered;
    }
    return (result?.rows ?? []).slice(0, PREVIEW_LIMIT);
  }, [effectiveEmployee, entryMode, manualRows, result]);

  const totalRows =
    entryMode === "manual"
      ? manualRows.filter(
          (row) =>
            !effectiveEmployee ||
            row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase(),
        ).length
      : (result?.rows.length ?? 0);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (entryMode !== "manual") return;
    if (!effectiveEmployee) return;
    const key = effectiveEmployee.toLowerCase();
    const found = employees.find(
      (emp) => emp.employeeName.toLowerCase() === key,
    );
    loadEmployeeRows(effectiveEmployee, found?.id, historyPagination.page);
  }, [entryMode, effectiveEmployee, employees, historyPagination.page]);

  useEffect(() => {
    if (timesheetHistory.length === 0) return;
    const selectedExists = timesheetHistory.find(
      (t) => t.id === selectedTimesheetId,
    );
    if (!selectedExists) {
      selectTimesheet(timesheetHistory[0].id);
    }
  }, [timesheetHistory, selectedTimesheetId]);

  useEffect(() => {
    if (entryMode !== "manual") return;

    const dates = manualRows
      .filter((row) => !row.isSoftDeleted)
      .map((row) => new Date(row.date))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (!dates.length) return;
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
      .toISOString()
      .slice(0, 10);
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
      .toISOString()
      .slice(0, 10);
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
    const matches = manualRows.filter(
      (row) =>
        row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase(),
    );
    if (matches.length) {
      setBulkName(effectiveEmployee);
      const firstDept = matches.find((r) => r.dept)?.dept ?? "";
      setBulkDept(firstDept || "");
    }
  }, [effectiveEmployee, manualRows]);

  useEffect(() => {
    setSelectedManualRowKeys([]);
    setSelectedUploadRowKeys([]);
  }, [entryMode, effectiveEmployee, selectedTimesheetId]);

  useEffect(() => {
    setSelectedManualRowKeys((prev) =>
      prev.filter((key) => manualRows.some((row) => String(row.id) === key)),
    );
  }, [manualRows]);

  useEffect(() => {
    setSelectedUploadRowKeys((prev) =>
      prev.filter((key) =>
        (result?.rows ?? []).some((row, idx) => getUploadRowKey(row, idx) === key),
      ),
    );
  }, [result?.rows]);

  const handleGeneratePayroll = async () => {
    if (entryMode === "manual") {
      const ok = await persistManualRows(manualRows);
      if (!ok) return;
      const activeRows = manualRows.filter((row) => !row.isSoftDeleted);
      const payloadRows: ParsedTimesheetRow[] = activeRows.map((row, idx) => {
        const status = row.attendanceStatus ?? "full_day";
        return {
          employeeName: row.employeeName,
          dept: row.dept ?? null,
          date: row.date,
          timeIn: status === "absent" ? null : (row.timeIn ?? null),
          timeOut: status === "absent" ? null : (row.timeOut ?? null),
          totalHours: status === "absent" ? null : row.totalHours,
          attendanceStatus: status,
          issues: [],
          sourceLine: idx + 1,
        };
      });
      sessionStorage.setItem("timesheetData", JSON.stringify(payloadRows));
      sessionStorage.setItem(
        "timesheetMeta",
        JSON.stringify({} satisfies TimesheetMeta),
      );
      router.push("/admin/payroll");
      return;
    }

    if (!result?.rows.length) {
      setError("Upload and parse a timesheet first.");
      return;
    }
    if (activeTimesheetId) {
      const ok = await updateTimesheetRows(result.rows);
      if (!ok) return;
    }
    sessionStorage.setItem("timesheetData", JSON.stringify(result.rows));
    sessionStorage.setItem(
      "timesheetMeta",
      JSON.stringify({
        format: result.format === "manual" ? undefined : result.format,
        timesheetId: result.timesheetId,
        startDate: result.startDate,
        endDate: result.endDate,
      } satisfies TimesheetMeta),
    );
    router.push("/admin/payroll");
  };

  const persistManualRows = async (
    rows: ManualRow[],
    deletedRows: DeletedRowPayload[] = [],
  ) => {
    const activeRows = rows.filter((row) => !row.isSoftDeleted);
    if (!activeRows.length) {
      setError("Add at least one manual row before saving.");
      return false;
    }

    const payloadRows = activeRows.map((row) => {
      const status = row.attendanceStatus ?? "full_day";
      return {
        id: typeof row.id === "number" ? row.id : undefined,
        employeeName: row.employeeName,
        dept: row.dept ?? "",
        date: row.date,
        timeIn: status === "absent" ? null : (row.timeIn ?? null),
        timeOut: status === "absent" ? null : (row.timeOut ?? null),
        totalHours: status === "absent" ? null : row.totalHours,
        attendanceStatus: status,
      };
    });

    try {
      setLoadingRows(true);
      const url = activeTimesheetId
        ? `/api/timesheets/${activeTimesheetId}`
        : "/api/timesheets";
      const method = activeTimesheetId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows, deletedRows }),
      });

      const data = (await response.json()) as TimesheetPayload | UploadError;

      if (!response.ok || !data || ("ok" in data && data.ok === false)) {
        const message =
          "error" in data ? data.error : "Failed to save manual timesheet";
        setError(message);
        return false;
      }

      hydrateFromServer(data as TimesheetPayload);
      loadEmployees();
      setManualMessage("Manual timesheet saved. Ready to generate payroll.");
      setError(null);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save manual timesheet",
      );
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
      const fileName = file.name.toLowerCase();
      let parseResult: ClientParseResult;

      // Parse Excel/CSV client-side
      if (
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls") ||
        fileName.endsWith(".csv")
      ) {
        const arrayBuffer = await file.arrayBuffer();

        if (fileName.endsWith(".csv")) {
          const text = await file.text();
          parseResult = parseCsvFileClient(text, file.name);
        } else {
          try {
            parseResult = parseExcelFileClient(arrayBuffer, file.name);
          } catch (parseError) {
            // If shift code template or other unsupported format, fallback to server-side parsing
            if (
              parseError instanceof Error &&
              parseError.message === "SHIFT_CODE_TEMPLATE"
            ) {
              console.log(
                "Shift code template detected, using server-side parsing",
              );
              const body = new FormData();
              body.append("file", file);

              const response = await fetch("/api/timesheets/upload", {
                method: "POST",
                body,
              });

              // Check if response is JSON before parsing
              const contentType = response.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error(
                  "Non-JSON response from API:",
                  text.substring(0, 500),
                );
                setError(
                  `Server returned an error (status ${response.status}). ` +
                    "Check Vercel function logs for details.",
                );
                return;
              }

              const data = (await response.json()) as
                | TimesheetPayload
                | UploadError;

              if (
                !response.ok ||
                !data ||
                ("ok" in data && data.ok === false)
              ) {
                const message =
                  "error" in data
                    ? data.error
                    : "Failed to parse file on server";
                setError(message);
                return;
              }

              const rows = (data as TimesheetPayload).rows.map((row) => ({
                ...row,
                attendanceStatus: row.attendanceStatus ?? "full_day",
              }));

              hydrateFromServer({ ...(data as TimesheetPayload), rows });
              const mergedCount =
                (data as TimesheetPayload).mergedFromDatabaseCount ?? 0;
              if (mergedCount > 0) {
                setUploadMessage(
                  `Merged ${mergedCount} existing row${mergedCount === 1 ? "" : "s"} from the database.`,
                );
              }
              const dupCheck = flagUploadDuplicates(rows);
              if (dupCheck.hasDuplicates) {
                setPreviewError(
                  "Each employee can only have one row per date. Fix duplicates before saving.",
                );
                if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
                if (dupCheck.firstIndex !== undefined)
                  scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
              } else {
                setInvalidFields({});
                setPreviewError(null);
              }
              loadEmployees();
              setEntryMode("upload");
              window.dispatchEvent(new CustomEvent("timesheet-updated"));
              return;
            }
            throw parseError;
          }
        }
      } else if (fileName.endsWith(".pdf")) {
        // PDF still needs server-side parsing - upload to API
        const body = new FormData();
        body.append("file", file);

        const response = await fetch("/api/timesheets/upload", {
          method: "POST",
          body,
        });
        const data = (await response.json()) as TimesheetPayload | UploadError;

        if (!response.ok || !data || ("ok" in data && data.ok === false)) {
          const message =
            "error" in data ? data.error : "Failed to parse PDF file";
          setError(message);
          return;
        }

        const rows = (data as TimesheetPayload).rows.map((row) => ({
          ...row,
          attendanceStatus: row.attendanceStatus ?? "full_day",
        }));

        hydrateFromServer({ ...(data as TimesheetPayload), rows });
        const mergedCount =
          (data as TimesheetPayload).mergedFromDatabaseCount ?? 0;
        if (mergedCount > 0) {
          setUploadMessage(
            `Merged ${mergedCount} existing row${mergedCount === 1 ? "" : "s"} from the database.`,
          );
        }
        const dupCheck = flagUploadDuplicates(rows);
        if (dupCheck.hasDuplicates) {
          setPreviewError(
            "Each employee can only have one row per date. Fix duplicates before saving.",
          );
          if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
          if (dupCheck.firstIndex !== undefined)
            scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
        } else {
          setInvalidFields({});
          setPreviewError(null);
        }
        loadEmployees();
        setEntryMode("upload");
        window.dispatchEvent(new CustomEvent("timesheet-updated"));
        return;
      } else {
        setError(
          "Unsupported file type. Upload Excel (.xlsx/.xls), CSV, or PDF.",
        );
        return;
      }

      // Send parsed data to API for merging with existing records
      const response = await fetch("/api/timesheets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedData: parseResult.rows,
          fileName: parseResult.fileName,
          format: parseResult.format,
          startDate: parseResult.startDate,
          endDate: parseResult.endDate,
        }),
      });

      const data = (await response.json()) as TimesheetPayload | UploadError;

      if (!response.ok || !data || ("ok" in data && data.ok === false)) {
        const message =
          "error" in data ? data.error : "Failed to process parsed data";
        setError(message);
        return;
      }

      const processedRows = (data as TimesheetPayload).rows.map((row) => ({
        ...row,
        attendanceStatus: row.attendanceStatus ?? "full_day",
      }));

      hydrateFromServer({ ...(data as TimesheetPayload), rows: processedRows });
      const mergedCount =
        (data as TimesheetPayload).mergedFromDatabaseCount ?? 0;
      if (mergedCount > 0) {
        setUploadMessage(
          `Merged ${mergedCount} existing row${mergedCount === 1 ? "" : "s"} from the database.`,
        );
      }
      const dupCheck = flagUploadDuplicates(processedRows);
      if (dupCheck.hasDuplicates) {
        setPreviewError(
          "Each employee can only have one row per date. Fix duplicates before saving.",
        );
        if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
        if (dupCheck.firstIndex !== undefined)
          scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
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
      id:
        manualEditingId ??
        `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeName: manualEmployee.trim(),
      date: manualDate,
      totalHours: parsedHours,
      dept: manualDept.trim() || null,
      isSoftDeleted: false,
    };

    setManualRows((rows) => {
      const exists = rows.some((row) => row.id === next.id);
      return exists
        ? rows.map((row) => (row.id === next.id ? { ...row, ...next } : row))
        : [...rows, next];
    });
    setError(null);
    setManualMessage(
      manualEditingId ? "Manual row updated." : "Manual row added.",
    );
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
      return rows.map((row) =>
        row.id === id ? { ...row, isSoftDeleted: !row.isSoftDeleted } : row,
      );
    });
  };

  const executeManualSave = async () => {
    setPreviewError(null);
    setInvalidFields({});
    if (!effectiveEmployee) {
      setPreviewError("Choose an employee before saving their rows.");
      return;
    }

    const withBulk = applyBulkToManualRows(manualRows);
    setManualRows(withBulk);

    const active = withBulk.filter(
      (row) =>
        !row.isSoftDeleted &&
        row.employeeName.trim() &&
        row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase(),
    );

    const negativeHours = active.filter(
      (row) =>
        row.totalHours !== null &&
        row.totalHours !== undefined &&
        Number(row.totalHours) < 0,
    );
    if (negativeHours.length) {
      setPreviewError("Hours cannot be negative.");
      const invalidMap: Record<string, string[]> = {};
      negativeHours.forEach((row) => {
        invalidMap[row.id] = ["totalHours"];
      });
      setInvalidFields(invalidMap);
      const firstNeg = negativeHours[0];
      scrollToRow(`preview-row-${firstNeg.id}`);
      return;
    }

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
      const missingTime =
        requiresTime &&
        (!row.timeIn ||
          !row.timeOut ||
          row.totalHours === null ||
          row.totalHours === undefined);
      return missingBase || missingTime;
    });

    if (invalid.length) {
      setPreviewError(
        "Add employee, date, time in/out, hours, and department for every row before saving.",
      );
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
          ...(requiresTime &&
          (row.totalHours === null || row.totalHours === undefined)
            ? ["totalHours"]
            : []),
        ];
      });
      setInvalidFields(invalidMap);
      const firstIdx = withBulk.findIndex((row) => {
        const status = row.attendanceStatus ?? "full_day";
        const requiresTime = status !== "absent";
        const missingBase = !row.employeeName.trim() || !row.date || !row.dept;
        const missingTime =
          requiresTime &&
          (row.totalHours === null ||
            row.totalHours === undefined ||
            !row.timeIn ||
            !row.timeOut);
        return (
          !row.isSoftDeleted &&
          row.employeeName.toLowerCase() === effectiveEmployee.toLowerCase() &&
          (missingBase || missingTime)
        );
      });
      if (firstIdx >= 0) {
        const id = `preview-row-${withBulk[firstIdx].id ?? firstIdx}`;
        scrollToRow(id);
      }
      return;
    }

    const duplicateIds = active
      .filter(
        (row) =>
          row.date &&
          (duplicateKeys.get(
            `${row.employeeName.trim().toLowerCase()}|${row.date}`,
          ) ?? 0) > 1,
      )
      .map((row) => row.id);

    if (duplicateIds.length) {
      setPreviewError(
        "Each employee can only have one row per date. Remove duplicates before saving.",
      );
      const invalidMap: Record<string, string[]> = {};
      duplicateIds.forEach((id) => {
        invalidMap[id] = ["date"];
      });
      setInvalidFields(invalidMap);
      const firstDuplicate = withBulk.find((row) =>
        duplicateIds.includes(row.id),
      );
      if (firstDuplicate) {
        scrollToRow(`preview-row-${firstDuplicate.id}`);
      }
      return;
    }

    setInvalidFields({});
    await persistManualRows(
      withBulk,
      getDeletedRowPayloads(
        manualBaselineRows,
        withBulk.map(createManualRowSnapshot),
      ),
    );
  };

  const handleManualSave = () => {
    const withBulk = applyBulkToManualRows(manualRows);
    setManualRows(withBulk);
    setPreviewError(null);
    setInvalidFields({});
    setSaveConfirmState({
      open: true,
      mode: "manual",
      summary: computeDiffSummary(
        manualBaselineRows,
        withBulk.map(createManualRowSnapshot),
      ),
    });
  };

  const executeUploadSave = async () => {
    if (!result) return;
    setPreviewError(null);
    setInvalidFields({});
    const activeRows = result.rows.filter((row) => !row.isSoftDeleted);
    const invalid = activeRows.filter((row) => {
      const status = row.attendanceStatus ?? "full_day";
      const requiresTime = status !== "absent";
      const missingBase = !row.employeeName?.trim() || !row.date || !row.dept;
      const missingTime =
        requiresTime &&
        (!row.timeIn ||
          !row.timeOut ||
          row.totalHours === null ||
          row.totalHours === undefined);
      return missingBase || missingTime;
    });
    if (invalid.length) {
      setPreviewError(
        "Add employee, date, time in/out, hours, and department for every row before saving.",
      );
      const invalidMap: Record<string, string[]> = {};
      invalid.forEach((row) => {
        const idxRow = result.rows.indexOf(row);
        const key = getUploadRowKey(row, idxRow);
        invalidMap[key] = [
          ...(row.employeeName?.trim() ? [] : ["employeeName"]),
          ...(row.date ? [] : ["date"]),
          ...(row.dept ? [] : ["dept"]),
          ...((row.attendanceStatus ?? "full_day") !== "absent" && !row.timeIn
            ? ["timeIn"]
            : []),
          ...((row.attendanceStatus ?? "full_day") !== "absent" && !row.timeOut
            ? ["timeOut"]
            : []),
          ...((row.attendanceStatus ?? "full_day") !== "absent" &&
          (row.totalHours === null || row.totalHours === undefined)
            ? ["totalHours"]
            : []),
        ];
      });
      setInvalidFields(invalidMap);
      const idx = result.rows.findIndex(
        (row) =>
          !row.employeeName?.trim() ||
          !row.date ||
          !row.dept ||
          ((row.attendanceStatus ?? "full_day") !== "absent" &&
            (row.totalHours === null ||
              row.totalHours === undefined ||
              !row.timeIn ||
              !row.timeOut)),
      );
      if (idx >= 0) {
        scrollToRow(`preview-row-upload-${idx}`);
      }
      return;
    }

    const negativeHours = activeRows.filter(
      (row) =>
        row.totalHours !== null &&
        row.totalHours !== undefined &&
        Number(row.totalHours) < 0,
    );

    if (negativeHours.length) {
      setPreviewError("Hours cannot be negative.");
      const invalidMap: Record<string, string[]> = {};
      negativeHours.forEach((row) => {
        const idxRow = result.rows.indexOf(row);
        invalidMap[getUploadRowKey(row, idxRow)] = ["totalHours"];
      });
      setInvalidFields(invalidMap);
      const first = result.rows.indexOf(negativeHours[0]);
      if (first >= 0) {
        scrollToRow(`preview-row-upload-${first}`);
      }
      return;
    }

    const dupCheck = flagUploadDuplicates(result.rows);
    if (dupCheck.hasDuplicates) {
      setPreviewError(
        "Each employee can only have one row per date. Fix duplicates before saving.",
      );
      if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
      if (dupCheck.firstIndex !== undefined)
        scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
      return;
    }

    setInvalidFields({});
    const deletedRows = getDeletedRowPayloads(
      uploadBaselineRows,
      result.rows.map(createUploadRowSnapshot),
    );
    const ok = activeTimesheetId
      ? await updateTimesheetRows(result.rows, deletedRows)
      : await saveUploadRows(result.rows, deletedRows);
    if (ok) {
      setUploadMessage("Upload rows saved.");
    }
  };

  const persistUploadRows = (rows: ParsedTimesheetRow[]) => {
    const active = ensureUploadRowKeys(rows).filter((row) => !row.isSoftDeleted);
    setResult((prev) => (prev ? { ...prev, rows: active } : prev));
  };

  const validateUploadPreview = (rows: ParsedTimesheetRow[]) => {
    const dupCheck = flagUploadDuplicates(rows);
    if (dupCheck.hasDuplicates) {
      setPreviewError(
        "Each employee can only have one row per date. Fix duplicates before saving.",
      );
      if (dupCheck.invalidMap) setInvalidFields(dupCheck.invalidMap);
      if (dupCheck.firstIndex !== undefined)
        scrollToRow(`preview-row-upload-${dupCheck.firstIndex}`);
      return false;
    }
    setInvalidFields({});
    setPreviewError(null);
    return true;
  };

  const flagUploadDuplicates = (rows: ParsedTimesheetRow[]) => {
    const activeRows = rows.filter((row) => !row.isSoftDeleted);
    const duplicateKeyCounts = new Map<string, number>();
    activeRows.forEach((row) => {
      const emp = (row.employeeId ?? row.employeeName ?? "")
        .toString()
        .trim()
        .toLowerCase();
      const date = row.date;
      if (!emp || !date) return;
      const key = `${emp}|${date}`;
      duplicateKeyCounts.set(key, (duplicateKeyCounts.get(key) ?? 0) + 1);
    });

    const duplicateIndices: number[] = [];
    rows.forEach((row, i) => {
      if (row.isSoftDeleted) return;
      const emp = (row.employeeId ?? row.employeeName ?? "")
        .toString()
        .trim()
        .toLowerCase();
      const date = row.date;
      if (!emp || !date) return;
      const key = `${emp}|${date}`;
      if ((duplicateKeyCounts.get(key) ?? 0) > 1) duplicateIndices.push(i);
    });

    if (!duplicateIndices.length) return { hasDuplicates: false } as const;

    const invalidMap: Record<string, string[]> = {};
    duplicateIndices.forEach((idxRow) => {
      invalidMap[getUploadRowKey(rows[idxRow], idxRow)] = ["date"];
    });

    return {
      hasDuplicates: true,
      invalidMap,
      firstIndex: duplicateIndices[0],
    } as const;
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
    setPreviewError(null);
    setInvalidFields({});
    setActiveTimesheetId(null);
    setStartDate(null);
    setEndDate(null);
    setManualRows([]);
    setCurrentEmployee(trimmed);
    setManualEmployee(trimmed);
    setBulkName(trimmed);
    setEntryMode("manual");
    const found = employees.find(
      (emp) => emp.employeeName.toLowerCase() === trimmed.toLowerCase(),
    );
    loadEmployeeRows(trimmed, found?.id);
    if (!found) {
      setEmployees((prev) => [
        ...prev,
        { id: 0, employeeName: trimmed, dayCount: 0 },
      ]);
    }
    setManualMessage(`Editing timesheet for ${trimmed}.`);
  };

  const manualDiffSummary = useMemo(
    () => computeDiffSummary(manualBaselineRows, manualRows.map(createManualRowSnapshot)),
    [manualBaselineRows, manualRows],
  );

  const uploadDiffSummary = useMemo(
    () =>
      computeDiffSummary(
        uploadBaselineRows,
        (result?.rows ?? []).map(createUploadRowSnapshot),
      ),
    [result?.rows, uploadBaselineRows],
  );

  const isPreviewRowPayrollLocked = (row: ParsedTimesheetRow | ManualRow) =>
    Boolean((row as ParsedTimesheetRow).isPayrollLocked);

  const previewSelection =
    entryMode === "manual" ? selectedManualRowKeys : selectedUploadRowKeys;

  const allPreviewSelected =
    previewRows.filter((row) => !isPreviewRowPayrollLocked(row)).length > 0 &&
    previewRows
      .filter((row) => !isPreviewRowPayrollLocked(row))
      .every((row, idx) => {
      if (entryMode === "manual") {
        return selectedManualRowKeys.includes(String((row as ManualRow).id));
      }
      return selectedUploadRowKeys.includes(
        getUploadRowKey(row as ParsedTimesheetRow, idx),
      );
      });

  const togglePreviewRowSelection = (key: string, isLocked = false) => {
    if (isLocked) return;
    if (entryMode === "manual") {
      setSelectedManualRowKeys((prev) =>
        prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
      );
      return;
    }
    setSelectedUploadRowKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const toggleSelectAllPreviewRows = () => {
    if (entryMode === "manual") {
      setSelectedManualRowKeys(
        allPreviewSelected
          ? []
          : previewRows
              .filter((row) => !isPreviewRowPayrollLocked(row))
              .map((row) => String((row as ManualRow).id)),
      );
      return;
    }
    setSelectedUploadRowKeys(
        allPreviewSelected
        ? []
        : previewRows
            .filter((row) => !isPreviewRowPayrollLocked(row))
            .map((row, idx) => getUploadRowKey(row as ParsedTimesheetRow, idx)),
    );
  };

  const deleteSelectedRows = () => {
    if (!previewSelection.length) return;
    if (entryMode === "manual") {
      setManualRows((rows) =>
        rows.filter(
          (row) =>
            row.isPayrollLocked || !selectedManualRowKeys.includes(String(row.id)),
        ),
      );
      setSelectedManualRowKeys([]);
      setManualMessage(
        `${previewSelection.length} row${previewSelection.length === 1 ? "" : "s"} deleted.`,
      );
      setError(null);
      return;
    }

    setResult((prev) => {
      if (!prev) return prev;
      const nextRows = prev.rows.filter(
        (row, idx) =>
          row.isPayrollLocked ||
          !selectedUploadRowKeys.includes(getUploadRowKey(row, idx)),
      );
      persistUploadRows(nextRows);
      return { ...prev, rows: nextRows };
    });
    setSelectedUploadRowKeys([]);
    setUploadMessage(
      `${previewSelection.length} row${previewSelection.length === 1 ? "" : "s"} deleted.`,
    );
    setError(null);
  };

  const openAddEmployeeDialog = () => {
    setAddEmployeeName(`New Employee ${newEmployeeCounter}`);
    setAddEmployeeSeedMode("single");
    setAddEmployeeSingleDate("");
    setRangeStart("");
    setRangeEnd("");
    setShowAddEmployeeDialog(true);
  };

  const createSeededRows = (
    employeeName: string,
    dates: string[],
  ): ManualRow[] =>
    dates.map((date) => ({
      ...createBlankManualRow(),
      employeeName,
      date,
      dept: bulkDept || "",
    }));

  const submitAddEmployeeDialog = () => {
    const trimmedName = addEmployeeName.trim();
    if (!trimmedName) {
      setError("Enter an employee name before adding.");
      return;
    }

    const dates: string[] = [];
    if (addEmployeeSeedMode === "single") {
      if (!addEmployeeSingleDate) {
        setError("Choose a date to seed the employee rows.");
        return;
      }
      dates.push(addEmployeeSingleDate);
    } else {
      const start = parseDateInput(rangeStart);
      const end = parseDateInput(rangeEnd);
      if (!start || !end) {
        setError("Choose a valid start and end date.");
        return;
      }
      if (start.getTime() > end.getTime()) {
        setError("Start date must be on or before end date.");
        return;
      }
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const seededRows = createSeededRows(trimmedName, dates);
    setManualRows(seededRows);
    setManualBaselineRows([]);
    setCurrentEmployee(trimmedName);
    setManualEmployee(trimmedName);
    setBulkName(trimmedName);
    setBulkDept("");
    setEntryMode("manual");
    setActiveTimesheetId(null);
    setSelectedTimesheetId(null);
    setTimesheetHistory([]);
    setHistoryPagination({ page: 1, limit: 5, total: 0, totalPages: 1 });
    setEmployees((prev) =>
      prev.some((item) => item.employeeName.toLowerCase() === trimmedName.toLowerCase())
        ? prev
        : [...prev, { id: 0, employeeName: trimmedName, dayCount: 0 }],
    );
    setNewEmployeeCounter((count) => count + 1);
    setManualMessage(
      `Created ${seededRows.length} starter row${seededRows.length === 1 ? "" : "s"} for ${trimmedName}.`,
    );
    setError(null);
    setShowAddEmployeeDialog(false);
  };

  const openSaveConfirmation = (mode: "manual" | "upload") => {
    setSaveConfirmState({
      open: true,
      mode,
      summary: mode === "manual" ? manualDiffSummary : uploadDiffSummary,
    });
  };

  const closeSaveConfirmation = () => {
    setSaveConfirmState({
      open: false,
      mode: null,
      summary: { added: 0, edited: 0, deleted: 0 },
    });
  };

  const restoreDeletedRows = () => {
    if (saveConfirmState.mode === "manual") {
      const currentKeys = new Set(manualRows.map((row) => row.id));
      const restoredRows = manualBaselineRows
        .filter((row) => !row.isSoftDeleted && !currentKeys.has(row.key))
        .map(snapshotToManualRow);

      if (!restoredRows.length) return;

      const nextRows = [...restoredRows, ...manualRows];
      setManualRows(nextRows);
      setSaveConfirmState({
        open: true,
        mode: "manual",
        summary: computeDiffSummary(
          manualBaselineRows,
          nextRows.map(createManualRowSnapshot),
        ),
      });
      setManualMessage(
        `Restored ${restoredRows.length} deleted row${restoredRows.length === 1 ? "" : "s"}.`,
      );
      return;
    }

    if (saveConfirmState.mode === "upload") {
      const currentRows = result?.rows ?? [];
      const currentKeys = new Set(
        currentRows.map((row, index) => getUploadRowKey(row, index)),
      );
      const restoredRows = uploadBaselineRows
        .filter((row) => !row.isSoftDeleted && !currentKeys.has(row.key))
        .map(snapshotToUploadRow);

      if (!restoredRows.length) return;

      const nextRows = ensureUploadRowKeys([...restoredRows, ...currentRows]);
      setResult((prev) => (prev ? { ...prev, rows: nextRows } : prev));
      setSaveConfirmState({
        open: true,
        mode: "upload",
        summary: computeDiffSummary(
          uploadBaselineRows,
          nextRows.map(createUploadRowSnapshot),
        ),
      });
      setUploadMessage(
        `Restored ${restoredRows.length} deleted row${restoredRows.length === 1 ? "" : "s"}.`,
      );
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
      <header className="space-y-2">
        <PageHeader>Timesheets</PageHeader>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            {entryMode === "upload"
              ? "Upload timesheets"
              : "Add timesheets manually"}
          </h1>

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
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
              Employees
            </p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Employees from upload or manual entry
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {entryMode === "manual" ? (
              <button
                type="button"
                onClick={openAddEmployeeDialog}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(47,109,246,0.22)] transition hover:scale-[1.01]"
              >
                Add employee
              </button>
            ) : null}
            {manualMessage ? (
              <span className="text-xs font-semibold text-emerald-700">
                {manualMessage}
              </span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="max-h-72 overflow-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Employee
                    </th>
                    {entryMode === "manual" ? (
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                        Action
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {loadingEmployees ? (
                    <tr>
                      <td
                        colSpan={entryMode === "manual" ? 2 : 1}
                        className="px-4 py-4 text-center text-[var(--muted)]"
                      >
                        Loading employees…
                      </td>
                    </tr>
                  ) : null}
                  {employeeList.length === 0 && !loadingEmployees ? (
                    <tr>
                      <td
                        colSpan={entryMode === "manual" ? 2 : 1}
                        className="px-4 py-4 text-center text-[var(--muted)]"
                      >
                        No employees yet. Add one to start a timesheet.
                      </td>
                    </tr>
                  ) : (
                    employeeList.map((name) => {
                      const isActive =
                        effectiveEmployee && effectiveEmployee === name;
                      return (
                        <tr
                          key={name}
                          className={`hover:bg-[var(--surface)]/60 ${isActive ? "bg-[var(--accent)]/5" : ""}`}
                        >
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
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Upload
              </p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Upload an Excel, CSV, or PDF
              </h2>
            </div>
            <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              Parser ready
            </span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block cursor-pointer rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/90 px-5 py-5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[var(--foreground)]">
                    Choose a file
                  </p>
                  <p>
                    Grab the timesheet template. Header casing does not matter.
                  </p>
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
                Required: Name + Date
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">
                Optional: Time In / Out / Hours
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 font-semibold">
                Hours auto-calc when Time In/Out are set
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {submitting ? "Parsing…" : "Upload and parse file"}
              </button>
              {error ? (
                <span className="text-sm font-semibold text-red-600">
                  {error}
                </span>
              ) : null}
              {!error && submitting ? (
                <span className="text-sm text-[var(--muted)]">
                  Working on it…
                </span>
              ) : null}
            </div>
          </form>
        </section>
      )}

      {false && entryMode === "manual" && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Employees
              </p>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Manual/Upload employees
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Up to ~30 employees. Click a row to open their timesheet; “Add
                employee” seeds 7 starter rows if none exist.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const label = `New Employee ${newEmployeeCounter}`;
                  const seeded = Array.from({ length: 20 }, () => ({
                    ...createBlankManualRow(),
                    employeeName: label,
                  }));
                  setManualRows(seeded);
                  setEmployees((prev) => [
                    ...prev,
                    { id: 0, employeeName: label, dayCount: 0 },
                  ]);
                  setCurrentEmployee(label);
                  setManualEmployee(label);
                  setBulkName(label);
                  setBulkDept("");
                  setNewEmployeeCounter((c) => c + 1);
                  setManualMessage(
                    `Created starter rows for ${label}. Name/Dept can be bulk-applied below.`,
                  );
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(47,109,246,0.22)] transition hover:scale-[1.01]"
              >
                Add employee
              </button>
              {manualMessage ? (
                <span className="text-xs font-semibold text-emerald-700">
                  {manualMessage}
                </span>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="max-h-72 overflow-auto">
                <table className="min-w-[620px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                        Days
                      </th>
                      <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {employeeList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-4 text-center text-[var(--muted)]"
                        >
                          No employees yet. Add one to start a timesheet.
                        </td>
                      </tr>
                    ) : (
                      employeeList.map((name) => {
                        const manualMatches = manualRows.filter(
                          (r) => r.employeeName === name,
                        );
                        const uploadMatches = (result?.rows ?? []).filter(
                          (r) => r.employeeName === name,
                        );
                        const daySet = new Set<string>();
                        manualMatches.forEach((r) => {
                          if (r.date) daySet.add(r.date);
                        });
                        uploadMatches.forEach((r) => {
                          if (r.date) daySet.add(r.date);
                        });
                        const dayCount = daySet.size;
                        const isActive =
                          effectiveEmployee && effectiveEmployee === name;
                        return (
                          <tr
                            key={name}
                            className={`hover:bg-[var(--surface)]/60 ${isActive ? "bg-[var(--accent)]/5" : ""}`}
                          >
                            <td className="px-4 py-3 font-semibold">{name}</td>
                            <td className="px-4 py-3 text-[var(--muted)]">
                              {dayCount || "—"}
                            </td>
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
              <p className="text-base font-semibold text-[var(--foreground)]">
                Pick or add an employee to edit their rows.
              </p>
            </div>
          )}
        </section>
      )}

      {(entryMode === "upload" ? result : true) ? (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                  Preview
                </p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  Showing the first {Math.min(PREVIEW_LIMIT, totalRows)} rows
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Review, edit, or delete rows before payroll runs.
                </p>
                {loadingRows ? (
                  <p className="text-xs font-semibold text-[var(--accent)]">
                    Loading timesheet rows…
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">
                  Total rows: {totalRows}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1">
                  Source:{" "}
                  {entryMode === "upload"
                    ? (result?.format?.toUpperCase() ?? "UPLOAD")
                    : "MANUAL"}
                </span>
                {(startDate || endDate) && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 text-[var(--accent)]">
                    Period: {startDate ?? "—"} to {endDate ?? "—"}
                  </span>
                )}
                {entryMode === "upload" && uploadMessage ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[var(--muted)]">
                    {uploadMessage}
                  </span>
                ) : null}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDateRangeDialog(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(47,109,246,0.2)] transition hover:scale-[1.01]"
                  >
                    + Add date range
                  </button>
                  <button
                    type="button"
                    onClick={addBlankRow}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:scale-[1.01]"
                  >
                    + Single row
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectAllPreviewRows}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
                  >
                    {allPreviewSelected ? "Clear all" : "Select all"}
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedRows}
                    disabled={!previewSelection.length}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete selected
                  </button>
                </div>
              </div>
            </div>

            {entryMode === "manual" &&
            effectiveEmployee &&
            timesheetHistory.length > 0 ? (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--foreground)]">
                      Timesheet History
                    </h4>
                    <p className="text-xs text-[var(--muted)]">
                      Showing {timesheetHistory.length} of{" "}
                      {historyPagination.total} uploads
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleHistoryPageChange(historyPagination.page - 1)
                      }
                      disabled={historyPagination.page <= 1}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      Page {historyPagination.page} of{" "}
                      {historyPagination.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleHistoryPageChange(historyPagination.page + 1)
                      }
                      disabled={
                        historyPagination.page >= historyPagination.totalPages
                      }
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {timesheetHistory.map((timesheet) => (
                    <button
                      key={timesheet.id}
                      type="button"
                      onClick={() => selectTimesheet(timesheet.id)}
                      className={`rounded-xl border p-4 text-left transition hover:scale-[1.01] ${
                        selectedTimesheetId === timesheet.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_4px_20px_rgba(47,109,246,0.12)]"
                          : "border-[var(--border)] bg-white hover:border-[var(--accent)]/50"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-lg">
                          {selectedTimesheetId === timesheet.id ? "✓" : "📄"}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                          {selectedTimesheetId === timesheet.id
                            ? "Selected"
                            : "Timesheet"}
                        </span>
                      </div>
                      <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">
                        {new Date(timesheet.uploadedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {timesheet.startDate} to {timesheet.endDate}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                        {timesheet.rowCount} row(s)
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {entryMode === "manual" && effectiveEmployee ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">
                    Employee name (applies to all rows)
                  </label>
                  <input
                    value={bulkName}
                    onChange={(e) => setBulkName(e.target.value)}
                    onBlur={() => {
                      if (!bulkName.trim()) return;
                      setManualRows((rows) =>
                        rows.map((r) =>
                          r.employeeName.toLowerCase() ===
                          effectiveEmployee.toLowerCase()
                            ? { ...r, employeeName: bulkName.trim() }
                            : r,
                        ),
                      );
                      setCurrentEmployee(bulkName.trim());
                      setManualEmployee(bulkName.trim());
                    }}
                    placeholder="Employee name"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">
                    Department (applies to all rows)
                  </label>
                  <input
                    value={bulkDept}
                    onChange={(e) => setBulkDept(e.target.value)}
                    onBlur={() => {
                      setManualRows((rows) =>
                        rows.map((r) =>
                          r.employeeName.toLowerCase() ===
                          effectiveEmployee.toLowerCase()
                            ? { ...r, dept: bulkDept }
                            : r,
                        ),
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
                  <label className="text-xs font-semibold text-[var(--muted)]">
                    Employee name (applies to all rows)
                  </label>
                  <input
                    value={bulkNameUpload}
                    onChange={(e) => setBulkNameUpload(e.target.value)}
                    onBlur={() => {
                      if (!result || !bulkNameUpload.trim()) return;
                      const nextRows = result.rows.map((r) => ({
                        ...r,
                        employeeName: bulkNameUpload.trim(),
                      }));
                      setResult({ ...result, rows: nextRows });
                    }}
                    placeholder="Employee name"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">
                    Department (applies to all rows)
                  </label>
                  <input
                    value={bulkDeptUpload}
                    onChange={(e) => setBulkDeptUpload(e.target.value)}
                    onBlur={() => {
                      if (!result) return;
                      const nextRows = result.rows.map((r) => ({
                        ...r,
                        dept: bulkDeptUpload,
                      }));
                      setResult({ ...result, rows: nextRows });
                    }}
                    placeholder="Department"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : null}

            {previewError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {previewError}
              </div>
            ) : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Select
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Time In
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Time Out
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Dept
                    </th>
                    <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-[0.24em]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-6 text-center text-[var(--muted)]"
                      >
                        No rows yet. Click “+ Add row” or upload a timesheet to
                        get started.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, idx) => {
                      const isManual = (row as ManualRow).id !== undefined;
                      const baseKey = isManual
                        ? (row as ManualRow).id
                        : getUploadRowKey(row as ParsedTimesheetRow, idx);
                      const attendanceStatus =
                        (row as ParsedTimesheetRow).attendanceStatus ??
                        (row as ManualRow).attendanceStatus ??
                        "full_day";
                      const isAbsent = attendanceStatus === "absent";
                      const isPayrollLocked = Boolean(
                        (row as ParsedTimesheetRow).isPayrollLocked,
                      );

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
                      const name =
                        (row as ParsedTimesheetRow).employeeName ??
                        (row as ManualRow).employeeName;
                      const date =
                        (row as ParsedTimesheetRow).date ??
                        (row as ManualRow).date;
                      const rawHours =
                        (row as ParsedTimesheetRow).totalHours ??
                        (row as ManualRow).totalHours;
                      const dept =
                        (row as ParsedTimesheetRow).dept ??
                        (row as ManualRow).dept ??
                        "";
                      const timeIn = isAbsent
                        ? ""
                        : ((row as ParsedTimesheetRow).timeIn ??
                          (row as ManualRow).timeIn ??
                          "");
                      const timeOut = isAbsent
                        ? ""
                        : ((row as ParsedTimesheetRow).timeOut ??
                          (row as ManualRow).timeOut ??
                          "");
                      const displayHours = isAbsent ? "" : (rawHours ?? "");

                      const updateRow = (
                        field:
                          | "employeeName"
                          | "date"
                          | "totalHours"
                          | "dept"
                          | "timeIn"
                          | "timeOut",
                        value: string,
                      ) => {
                        if (isPayrollLocked) return;
                        if (
                          isAbsent &&
                          (field === "timeIn" ||
                            field === "timeOut" ||
                            field === "totalHours")
                        )
                          return;
                        if (entryMode === "manual") {
                          setManualRows((rows) => {
                            const updated = rows.map((r) =>
                              (r as ManualRow).id === baseKey
                                ? {
                                    ...r,
                                    [field]:
                                      field === "totalHours"
                                        ? value === ""
                                          ? null
                                          : Number(value) || 0
                                        : value,
                                  }
                                : r,
                            );
                            return updated;
                          });
                        } else {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const nextRows = [...prev.rows];
                            const nextRow = {
                              ...nextRows[idx],
                              [field]:
                                field === "totalHours"
                                  ? Number(value) || 0
                                  : value,
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
                        if (isPayrollLocked) return;
                        if (entryMode === "manual") {
                          handleManualDelete(baseKey);
                          setManualMessage("Row deleted.");
                        } else {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const nextRows = prev.rows.filter(
                              (_, i) => i !== idx,
                            );
                            persistUploadRows(nextRows);
                            setError(null);
                            return { ...prev, rows: nextRows };
                          });
                          setUploadMessage("Row deleted.");
                        }
                      };

                      const toggleSoftDelete = () => {
                        if (isPayrollLocked) return;
                        if (entryMode === "manual") {
                          handleManualSoftDelete(baseKey);
                        } else {
                          setResult((prev) => {
                            if (!prev) return prev;
                            const nextRows = prev.rows.map((rowItem, i) =>
                              i === idx
                                ? {
                                    ...rowItem,
                                    isSoftDeleted: !rowItem.isSoftDeleted,
                                  }
                                : rowItem,
                            );
                            persistUploadRows(nextRows);
                            setUploadMessage(
                              nextRows[idx].isSoftDeleted
                                ? "Row soft deleted"
                                : "Row restored",
                            );
                            return { ...prev, rows: nextRows };
                          });
                        }
                      };

                      return (
                        <tr
                          key={baseKey}
                          id={
                            isManual
                              ? `preview-row-${baseKey}`
                              : `preview-row-upload-${idx}`
                          }
                          className={`hover:bg-[var(--surface)]/60 ${row.isSoftDeleted ? "opacity-60" : ""} ${isPayrollLocked ? "bg-slate-100 text-slate-500" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={previewSelection.includes(String(baseKey))}
                              onChange={() =>
                                togglePreviewRowSelection(String(baseKey), isPayrollLocked)
                              }
                              className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                              disabled={isPayrollLocked}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={
                                entryMode === "manual"
                                  ? bulkName || name || ""
                                  : name || ""
                              }
                              onChange={(e) =>
                                updateRow("employeeName", e.target.value)
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("employeeName") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={entryMode === "manual" || isPayrollLocked}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={date ?? ""}
                              onChange={(e) =>
                                updateRow("date", e.target.value)
                              }
                              disabled={isPayrollLocked}
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("date") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={timeIn}
                              onChange={(e) =>
                                updateRow("timeIn", e.target.value)
                              }
                              placeholder="09:00"
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("timeIn") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={isAbsent || isPayrollLocked}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={timeOut}
                              onChange={(e) =>
                                updateRow("timeOut", e.target.value)
                              }
                              placeholder="18:00"
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("timeOut") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={isAbsent || isPayrollLocked}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={displayHours}
                              onChange={(e) =>
                                updateRow("totalHours", e.target.value)
                              }
                              step="0.01"
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("totalHours") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={isAbsent || isPayrollLocked}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={
                                entryMode === "manual"
                                  ? bulkDept || dept || ""
                                  : dept
                              }
                              onChange={(e) =>
                                updateRow("dept", e.target.value)
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-[0_1px_0_rgba(16,40,94,0.04)] ${invalidFields[baseKey]?.includes("dept") ? "border-red-400 bg-red-50" : "border-[var(--border)] bg-white"}`}
                              disabled={entryMode === "manual" || isPayrollLocked}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={
                                row.isSoftDeleted ? "deleted" : attendanceStatus
                              }
                              onChange={(e) => {
                                if (isPayrollLocked) return;
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
                                              attendanceStatus: newStatus as
                                                | "full_day"
                                                | "half_day"
                                                | "absent",
                                              isSoftDeleted: false,
                                              timeIn:
                                                newStatus === "absent"
                                                  ? null
                                                  : r.timeIn,
                                              timeOut:
                                                newStatus === "absent"
                                                  ? null
                                                  : r.timeOut,
                                              totalHours:
                                                newStatus === "absent"
                                                  ? null
                                                  : r.totalHours,
                                            }
                                          : r,
                                      );
                                      return updated;
                                    });
                                  } else {
                                    setResult((prev) => {
                                      if (!prev) return prev;
                                      const nextRows = [...prev.rows];
                                      nextRows[idx] = {
                                        ...nextRows[idx],
                                        attendanceStatus: newStatus as
                                          | "full_day"
                                          | "half_day"
                                          | "absent",
                                        isSoftDeleted: false,
                                        timeIn:
                                          newStatus === "absent"
                                            ? null
                                            : nextRows[idx].timeIn,
                                        timeOut:
                                          newStatus === "absent"
                                            ? null
                                            : nextRows[idx].timeOut,
                                        totalHours:
                                          newStatus === "absent"
                                            ? null
                                            : nextRows[idx].totalHours,
                                      };
                                      persistUploadRows(nextRows);
                                      return { ...prev, rows: nextRows };
                                    });
                                  }
                                }
                              }}
                              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${row.isSoftDeleted ? "border-red-200 bg-red-50 text-red-700" : getStatusColor(attendanceStatus)}`}
                              disabled={isPayrollLocked}
                            >
                              <option value="full_day">Full Day</option>
                              <option value="half_day">Half Day</option>
                              <option value="absent">Absent</option>
                              {row.isSoftDeleted && (
                                <option value="deleted">Deleted</option>
                              )}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isPayrollLocked ? (
                                <span className="rounded-full border border-slate-300 bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  Payroll locked
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={removeRow}
                                disabled={isPayrollLocked}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                              >
                                Delete
                              </button>
                            </div>
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
                    {manualMessage ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        {manualMessage}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openSaveConfirmation("upload")}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(47,109,246,0.2)] hover:scale-[1.01]"
                    >
                      Save
                    </button>
                    {uploadMessage ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        {uploadMessage}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
              <span className="text-xs">
                Showing {Math.min(PREVIEW_LIMIT, totalRows)} of {totalRows}{" "}
                row(s)
              </span>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
            <p className="text-base font-semibold text-[var(--foreground)]">
              No rows yet
            </p>
            <p className="mt-1">
              Upload a file or switch to Manual to start adding rows.
            </p>
          </div>
        </section>
      )}

      {showAddEmployeeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_24px_70px_rgba(16,40,94,0.2)]">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Add employee
              </p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Create employee starter rows
              </h3>
            </div>
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted)]">
                  Employee name
                </label>
                <input
                  value={addEmployeeName}
                  onChange={(e) => setAddEmployeeName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAddEmployeeSeedMode("single")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${addEmployeeSeedMode === "single" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-white text-[var(--foreground)]"}`}
                >
                  Single day
                </button>
                <button
                  type="button"
                  onClick={() => setAddEmployeeSeedMode("range")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${addEmployeeSeedMode === "range" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-white text-[var(--foreground)]"}`}
                >
                  Date range
                </button>
              </div>
              {addEmployeeSeedMode === "single" ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--muted)]">
                    Date
                  </label>
                  <input
                    type="date"
                    value={addEmployeeSingleDate}
                    onChange={(e) => setAddEmployeeSingleDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      End date
                    </label>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddEmployeeDialog(false)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddEmployeeDialog}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Add employee
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDateRangeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_24px_70px_rgba(16,40,94,0.2)]">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Add date range
              </p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Seed rows into the preview
              </h3>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted)]">
                  Start date
                </label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted)]">
                  End date
                </label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDateRangeDialog(false)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addDateRangeRows}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Add dates
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveConfirmState.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_24px_70px_rgba(16,40,94,0.2)]">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Confirm save
              </p>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">
                Review changes before saving
              </h3>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Added
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800">
                  {saveConfirmState.summary.added}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Edited
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-800">
                  {saveConfirmState.summary.edited}
                </p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                  Deleted
                </p>
                <p className="mt-1 text-2xl font-semibold text-red-800">
                  {saveConfirmState.summary.deleted}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">
              Validation will run after you confirm, and database save behavior stays the same.
            </p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={restoreDeletedRows}
                disabled={saveConfirmState.summary.deleted === 0}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Restore deleted rows
              </button>
              <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeSaveConfirmation}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const mode = saveConfirmState.mode;
                  closeSaveConfirmation();
                  if (mode === "manual") {
                    await executeManualSave();
                    return;
                  }
                  if (mode === "upload") {
                    await executeUploadSave();
                  }
                }}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm save
              </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
