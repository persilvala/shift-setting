// @ts-nocheck
import type { AttendanceStatus } from "@/lib/types";
import { prisma } from "@/lib/db";

type ManualInputRow = {
  employeeName: string;
  dept?: string | null;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  totalHours?: number | null;
  attendanceStatus?: AttendanceStatus;
};

type NormalizedRow = {
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
  timesheetId?: string | null;
  manualOptions?: ManualOptions;
}) {
  const validated = normalizeRows(options.rows ?? []);
  if (!validated.ok || !validated.rows || !validated.startDate || !validated.endDate || !validated.employeeNames) {
    return { ok: false as const, status: 400, error: (validated.errors ?? ["Invalid input."]).join(" ") };
  }

  const { format, fileName, entrySource } = buildTimesheetDefaults(options.manualOptions);
  const rows = validated.rows;
  const startDate = validated.startDate;
  const endDate = validated.endDate;

  const result = await prisma.$transaction(async (tx) => {
    const employeeMap = await ensureEmployees(tx, validated.employeeNames!);

    const rowsWithEmployees = rows.map((row) => {
      const emp = employeeMap.get(row.employeeName.toLowerCase());
      return { ...row, employeeId: emp?.id ?? null };
    });

    let targetTimesheetId = options.timesheetId ?? null;
    let targetTimesheetFormat = format;

    if (options.timesheetId) {
      const timesheetLookupId: any = options.timesheetId;
      const existingTimesheet = await tx.timesheet.findUnique({ where: { id: timesheetLookupId } as any });
      if (!existingTimesheet) {
        return { error: "Timesheet not found", status: 404 as const };
      }
      targetTimesheetId = (existingTimesheet as any).id as any;
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
      targetTimesheetId = (created as any).id as any;
      targetTimesheetFormat = (created as any).format;
    }

    const keys = rowsWithEmployees.map((row) => ({ employeeId: row.employeeId ?? "", date: new Date(row.date) }));
    const existingRows = keys.length
      ? await tx.timesheetRow.findMany({ where: { OR: keys.map((k) => ({ employeeId: k.employeeId as any, date: k.date })) } as any })
      : [];

    const existingMap = new Map<string, (typeof existingRows)[number]>();
    existingRows.forEach((row) => {
      existingMap.set(`${row.employeeId ?? ""}|${row.date.toISOString().slice(0, 10)}`, row);
    });

    const upserted: (typeof existingRows)[number][] = [];

    for (const row of rowsWithEmployees) {
      const status = row.attendanceStatus ?? "full_day";
      const key = `${row.employeeId ?? ""}|${row.date}`;
      const existing = existingMap.get(key);
      const totalHours = status === "absent" ? null : row.totalHours;
      const timeIn = status === "absent" ? null : row.timeIn;
      const timeOut = status === "absent" ? null : row.timeOut;
      const dept = row.dept?.trim() || existing?.dept || null;

      if (existing) {
        const updated = await tx.timesheetRow.update({
          where: { id: existing.id },
          data: {
            timesheetId: targetTimesheetId!,
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
            timesheetId: targetTimesheetId!,
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
      where: { id: targetTimesheetId! as any },
      data: {
        totalRows: upserted.length,
        startDate,
        endDate,
      },
    });

    const refreshedRows = await tx.timesheetRow.findMany({
      where: { timesheetId: targetTimesheetId! as any },
      orderBy: [{ date: "asc" }, { employeeName: "asc" }],
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

  if ("error" in result) {
    return { ok: false as const, status: (result as any).status ?? 500, error: (result as any).error };
  }

  return { ok: true as const, ...(result as any) };
}

export const manualTimesheetMapper = { mapRowResponse };

export function validateManualRows(rows: ManualInputRow[]): ValidationResult {
  return normalizeRows(rows);
}
