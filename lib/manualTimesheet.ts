/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AttendanceStatus } from "@/lib/types";
import { prisma } from "@/lib/db";

type ManualInputRow = {
  id?: number | null;
  employeeName: string;
  dept?: string | null;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  totalHours?: number | null;
  attendanceStatus?: AttendanceStatus;
};

type NormalizedRow = {
  id?: number | null;
  employeeName: string;
  dept: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  attendanceStatus: AttendanceStatus;
};

type ValidationResult = {
  ok: boolean;
  errors?: string[];
  rows?: NormalizedRow[];
  startDate?: Date;
  endDate?: Date;
  employeeNames?: string[];
};

type ManualOptions = {
  fileName?: string | null;
  format?: string | null;
  entrySource?: string | null;
};

type DeletedRowInput = {
  id?: number | null;
  employeeName: string;
  employeeId?: number | null;
  date: string;
};

const MAX_DAYS_PER_EMPLOYEE = 20;

function scoreRow(row: NormalizedRow) {
  let score = 0;
  if (row.timeIn) score += 1;
  if (row.timeOut) score += 1;
  if (row.totalHours !== null && row.totalHours !== undefined) score += 2;
  return score;
}

function normalizeRows(rows: ManualInputRow[]): ValidationResult {
  const errors: string[] = [];
  const normalized: NormalizedRow[] = [];
  const perEmployeeDates = new Map<string, Set<string>>();
  const dates: Date[] = [];

  for (const raw of rows) {
    const employeeName = raw.employeeName?.trim() ?? "";
    const dept = raw.dept?.trim() ?? "";
    const date = raw.date?.trim() ?? "";
    const status = (raw.attendanceStatus ?? "full_day") as AttendanceStatus;

    if (!employeeName) errors.push("Employee name is required for all rows.");
    if (!dept) errors.push("Department is required for all rows.");
    if (!date) errors.push("Date is required for all rows.");

    const parsedDate = date ? new Date(date) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      errors.push(`Invalid date: ${date}`);
    } else {
      dates.push(parsedDate);
    }

    const needsTime = status !== "absent";
    const totalHours = raw.totalHours ?? null;

    const timeIn = needsTime ? raw.timeIn?.trim?.() || null : null;
    const timeOut = needsTime ? raw.timeOut?.trim?.() || null : null;
    const hoursNumber = totalHours === null || totalHours === undefined ? null : Number(totalHours);

    if (needsTime) {
      if (!timeIn) errors.push(`Time In is required for ${employeeName || "employee"} on ${date}.`);
      if (!timeOut) errors.push(`Time Out is required for ${employeeName || "employee"} on ${date}.`);
      if (hoursNumber === null || Number.isNaN(hoursNumber)) {
        errors.push(`Hours are required for ${employeeName || "employee"} on ${date}.`);
      }
      if (hoursNumber !== null && hoursNumber < 0) {
        errors.push(`Hours cannot be negative for ${employeeName || "employee"} on ${date}.`);
      }
    }

    const empKey = employeeName.toLowerCase();
    const daySet = perEmployeeDates.get(empKey) ?? new Set<string>();
    if (daySet.has(date)) {
      errors.push(`Duplicate date ${date} for ${employeeName}. Each employee needs unique dates.`);
    }
    daySet.add(date);
    if (daySet.size > MAX_DAYS_PER_EMPLOYEE) {
      errors.push(`Timesheets support up to ${MAX_DAYS_PER_EMPLOYEE} days per employee. ${employeeName} exceeds this limit.`);
    }
    perEmployeeDates.set(empKey, daySet);

    normalized.push({
      id: raw.id ?? null,
      employeeName,
      dept,
      date,
      timeIn,
      timeOut,
      totalHours: status === "absent" ? null : hoursNumber,
      attendanceStatus: status,
    });
  }

  if (errors.length) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  if (!normalized.length) {
    return { ok: false, errors: ["At least one row is required."] };
  }

  const dedup = new Map<string, NormalizedRow>();
  normalized.forEach((row) => {
    const key = `${row.employeeName.toLowerCase()}|${row.date}`;
    const existing = dedup.get(key);
    if (!existing || scoreRow(row) > scoreRow(existing)) {
      dedup.set(key, row);
    }
  });

  const dedupedRows = Array.from(dedup.values());
  const employeeNames = [...new Set(dedupedRows.map((r) => r.employeeName))];

  const validDates = dates.filter((d) => !Number.isNaN(d.getTime()));
  const startDate = validDates.length ? new Date(Math.min(...validDates.map((d) => d.getTime()))) : undefined;
  const endDate = validDates.length ? new Date(Math.max(...validDates.map((d) => d.getTime()))) : undefined;

  return { ok: true, rows: dedupedRows, startDate, endDate, employeeNames };
}

async function ensureEmployees(tx: any, employeeNames: string[]) {
  if (!employeeNames.length) return new Map<string, { id: string; employeeName: string }>();

  const existing = await tx.employee.findMany({ where: { employeeName: { in: employeeNames } } });
  const existingMap = new Map(existing.map((emp: any) => [emp.employeeName.toLowerCase(), emp]));

  const results = [...existing];
  for (const name of employeeNames) {
    if (existingMap.has(name.toLowerCase())) continue;
    const created = await tx.employee.create({ data: { employeeName: name } });
    results.push(created);
    existingMap.set(name.toLowerCase(), created);
  }

  return new Map(results.map((emp) => [emp.employeeName.toLowerCase(), emp]));
}

function mapRowResponse(row: any) {
  return {
    id: row.id,
    employeeName: row.employeeName,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    timeIn: row.beforeNoonIn ?? null,
    timeOut: row.beforeNoonOut ?? null,
    totalHours: row.totalHours ?? row.workHours ?? null,
    issues: [],
    sourceLine: 0,
    dept: row.dept ?? null,
    userId: row.userId ?? null,
    employeeId: row.employeeId ?? undefined,
    attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? "full_day",
    isPayrollLocked: (row.payrollEntries?.length ?? 0) > 0,
  };
}

function buildTimesheetDefaults(options?: ManualOptions) {
  const format = options?.format ?? "manual";
  const fileName = options?.fileName ?? (format === "manual" ? "manual-entry" : "upload");
  const entrySource = options?.entrySource ?? (format === "manual" ? "manual" : "upload");
  return { format, fileName, entrySource };
}

export async function upsertManualTimesheet(options: {
  rows: ManualInputRow[];
  deletedRows?: DeletedRowInput[];
  timesheetId?: string | null;
  manualOptions?: ManualOptions;
}) {
  const validated = normalizeRows(options.rows ?? []);
  console.log("[upsertManualTimesheet] Validation result:", validated.ok, "rows:", validated.rows?.length, "errors:", validated.errors);
  if (!validated.ok || !validated.rows || !validated.startDate || !validated.endDate || !validated.employeeNames) {
    return { ok: false as const, status: 400, error: (validated.errors ?? ["Invalid input."]).join(" ") };
  }

  const { format, fileName, entrySource } = buildTimesheetDefaults(options.manualOptions);
  const rows = validated.rows;
  const startDate = validated.startDate;
  const endDate = validated.endDate;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      console.log("[upsertManualTimesheet] Starting transaction, employees:", validated.employeeNames);
    const employeeMap = await ensureEmployees(tx, validated.employeeNames!);
    console.log("[upsertManualTimesheet] Employee map created, size:", employeeMap.size);

    const rowsWithEmployees = rows.map((row) => {
      const emp = employeeMap.get(row.employeeName.toLowerCase());
      return { ...row, employeeId: emp?.id ?? null };
    });

    const deletedRows = (options.deletedRows ?? []).map((row) => ({
      id: row.id ?? null,
      employeeName: row.employeeName?.trim?.() ?? "",
      employeeId: row.employeeId ?? null,
      date: row.date,
    }));

    const employeeNamesForValidation = [...new Set(rowsWithEmployees.map((r) => r.employeeName))];
    const existingRowsAll = await tx.timesheetRow.findMany({
      where: { employeeName: { in: employeeNamesForValidation } },
      select: { employeeName: true, dept: true },
    });

    const existingDeptMap = new Map<string, string>();
    existingRowsAll.forEach((row) => {
      if (row.dept && !existingDeptMap.has(row.employeeName)) {
        existingDeptMap.set(row.employeeName, row.dept);
      }
    });

    const deptErrors: string[] = [];
    rowsWithEmployees.forEach((row) => {
      const existingDept = existingDeptMap.get(row.employeeName);
      if (existingDept && row.dept && row.dept.trim().toLowerCase() !== existingDept.trim().toLowerCase()) {
        deptErrors.push(`Department mismatch for ${row.employeeName}. Existing: ${existingDept}`);
      }
      if (existingDept && (!row.dept || !row.dept.trim())) {
        row.dept = existingDept;
      }
    });

    if (deptErrors.length) {
      return { error: Array.from(new Set(deptErrors)).join(" "), status: 400 as const };
    }

    let targetTimesheetId: number | null = options.timesheetId
      ? Number(options.timesheetId)
      : null;
    let targetTimesheetFormat = format;

    if (options.timesheetId) {
      const timesheetLookupId = Number(options.timesheetId);
      if (Number.isNaN(timesheetLookupId)) {
        return { error: "Timesheet not found", status: 404 as const };
      }
      const existingTimesheet = await tx.timesheet.findUnique({
        where: { id: timesheetLookupId } as any,
      });
      if (!existingTimesheet) {
        return { error: "Timesheet not found", status: 404 as const };
      }
      targetTimesheetId = Number((existingTimesheet as any).id);
      targetTimesheetFormat = (existingTimesheet as any).format;
    }

    if (!targetTimesheetId) {
      const created = await tx.timesheet.create({
        data: {
          fileName,
          format,
          entrySource,
          startDate,
          endDate,
          totalRows: 0,
        },
      });
      targetTimesheetId = Number((created as any).id);
      targetTimesheetFormat = (created as any).format;
    }

    if (deletedRows.length) {
      const deleteById = deletedRows
        .filter((row) => row.id !== null && row.id !== undefined)
        .map((row) => row.id as number);
      const deleteByIdentity = deletedRows.filter(
        (row) => row.id === null || row.id === undefined,
      );

      const deleteOr: any[] = [];
      if (deleteById.length) {
        deleteOr.push({ id: { in: deleteById } });
      }
      deleteByIdentity.forEach((row) => {
        if (!row.date) return;
        if (row.employeeId !== null && row.employeeId !== undefined) {
          deleteOr.push({ employeeId: row.employeeId as any, date: new Date(row.date) });
          return;
        }
        if (row.employeeName) {
          deleteOr.push({ employeeName: row.employeeName, date: new Date(row.date) });
        }
      });

      if (deleteOr.length) {
        const lockedRows = await tx.timesheetRow.findMany({
          where: {
            timesheetId: targetTimesheetId,
            OR: deleteOr,
          } as any,
          select: {
            id: true,
            payrollEntries: {
              select: { id: true },
              take: 1,
            },
          },
        });
        const deletableIds = lockedRows
          .filter((row) => row.payrollEntries.length === 0)
          .map((row) => row.id);

        if (deletableIds.length) {
        await tx.timesheetRow.deleteMany({
          where: {
            timesheetId: targetTimesheetId,
            id: { in: deletableIds },
          } as any,
        });
        }
      }
    }

    const rowsWithIds = rowsWithEmployees.map((row) => ({
      ...row,
      id: row.id ?? null,
    }));

    const keys = rowsWithIds
      .filter((row) => row.id === null || row.id === undefined)
      .map((row) => ({ employeeId: row.employeeId ?? "", date: new Date(row.date) }));
    const rowIds = rowsWithIds
      .map((row) => row.id)
      .filter((rowId): rowId is number => rowId !== null && rowId !== undefined);
    console.log("[upsertManualTimesheet] Looking up existing rows, keys:", keys.length);
    const existingRows = keys.length || rowIds.length
      ? await tx.timesheetRow.findMany({
          where: {
            timesheetId: targetTimesheetId,
            OR: [
              ...(keys.length
                ? keys.map((k) => ({ employeeId: k.employeeId as any, date: k.date }))
                : []),
              ...(rowIds.length ? [{ id: { in: rowIds } }] : []),
            ],
          } as any,
          include: {
            payrollEntries: {
              select: { id: true },
              take: 1,
            },
          },
        })
      : [];
    console.log("[upsertManualTimesheet] Found existing rows:", existingRows.length);

    const existingMap = new Map<string, (typeof existingRows)[number]>();
    existingRows.forEach((row) => {
      existingMap.set(`${row.employeeId ?? ""}|${row.date.toISOString().slice(0, 10)}`, row);
    });
    const existingById = new Map<number, (typeof existingRows)[number]>();
    existingRows.forEach((row) => {
      existingById.set(row.id, row);
    });

    const upserted: (typeof existingRows)[number][] = [];
    console.log("[upsertManualTimesheet] Rows to process:", rowsWithIds.length);

    for (const row of rowsWithIds) {
      const status = row.attendanceStatus ?? "full_day";
      const key = `${row.employeeId ?? ""}|${row.date}`;
      const existing =
        (row.id !== null && row.id !== undefined
          ? existingById.get(row.id)
          : undefined) ?? existingMap.get(key);
      const totalHours = status === "absent" ? null : row.totalHours;
      const timeIn = status === "absent" ? null : row.timeIn;
      const timeOut = status === "absent" ? null : row.timeOut;
      const dept = row.dept?.trim() || existing?.dept || null;
      const isPayrollLocked = (existing as any)?.payrollEntries?.length > 0;

      if (existing) {
        if (isPayrollLocked) {
          upserted.push(existing);
          continue;
        }
        const updated = await tx.timesheetRow.update({
          where: { id: existing.id },
          data: {
            timesheetId: targetTimesheetId,
            employeeName: row.employeeName,
            employeeId: row.employeeId ?? undefined,
            date: new Date(row.date),
            dept,
            beforeNoonIn: timeIn,
            beforeNoonOut: timeOut,
            totalHours,
            workHours: totalHours,
            attendanceStatus: status,
          } as any,
        });
        upserted.push(updated);
      } else {
        const created = await tx.timesheetRow.create({
          data: {
            timesheetId: targetTimesheetId,
            employeeName: row.employeeName,
            employeeId: row.employeeId ?? undefined,
            date: new Date(row.date),
            dept,
            beforeNoonIn: timeIn,
            beforeNoonOut: timeOut,
            totalHours,
            workHours: totalHours,
            attendanceStatus: status,
          } as any,
        });
        upserted.push(created);
      }
    }

    await tx.timesheet.update({
      where: { id: targetTimesheetId as any },
      data: {
        totalRows: upserted.length,
        startDate,
        endDate,
      },
    });

    const refreshedRows = await tx.timesheetRow.findMany({
      where: { timesheetId: targetTimesheetId as any },
      orderBy: [{ date: "asc" }, { employeeName: "asc" }],
      include: {
        payrollEntries: {
          select: { id: true },
          take: 1,
        },
      },
    });

    const refreshedDates = refreshedRows.map((r) => r.date).filter(Boolean);
    const updatedStart = refreshedDates.length
      ? new Date(Math.min(...refreshedDates.map((d) => d.getTime())))
      : startDate;
    const updatedEnd = refreshedDates.length
      ? new Date(Math.max(...refreshedDates.map((d) => d.getTime())))
      : endDate;

    return {
      timesheetId: targetTimesheetId!,
      format: targetTimesheetFormat,
      fileName,
      startDate: updatedStart,
      endDate: updatedEnd,
      rows: refreshedRows,
    };
    });
  } catch (error) {
    console.error("[upsertManualTimesheet] Transaction error:", error);
    throw error;
  }

  if ("error" in result) {
    return { ok: false as const, status: (result as any).status ?? 500, error: (result as any).error };
  }

  return { ok: true as const, ...(result as any) };
}

export const manualTimesheetMapper = { mapRowResponse };

export function validateManualRows(rows: ManualInputRow[]): ValidationResult {
  return normalizeRows(rows);
}
