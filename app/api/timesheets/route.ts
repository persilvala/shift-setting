import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { AttendanceStatus } from '@/lib/types';

export async function GET() {
  try {
    const timesheets = await prisma.timesheet.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        format: true,
        startDate: true,
        endDate: true,
        totalRows: true,
        uploadedAt: true,
        _count: { select: { rows: true } },
      },
    });

    return NextResponse.json({ timesheets });
  } catch (error) {
    console.error('Failed to fetch timesheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheets' },
      { status: 500 }
    );
  }
}

type ManualRequestRow = {
  employeeName: string;
  dept: string;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  totalHours?: number | null;
  attendanceStatus?: AttendanceStatus;
};

type TimesheetCreateOptions = {
  fileName?: string | null;
  format?: string | null;
  entrySource?: string | null;
};

function mapRowResponse(row: { [key: string]: any }) {
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
    attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? 'full_day',
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = (body?.rows ?? []) as ManualRequestRow[];
    const options = (body ?? {}) as TimesheetCreateOptions;

    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ ok: false, error: 'At least one row is required.' }, { status: 400 });
    }

    const normalized = rows.map((row) => ({
      employeeName: row.employeeName?.trim() ?? '',
      dept: row.dept?.trim() ?? '',
      date: row.date?.trim() ?? '',
      timeIn: row.timeIn?.trim() || null,
      timeOut: row.timeOut?.trim() || null,
      totalHours: row.totalHours ?? null,
      attendanceStatus: (row.attendanceStatus ?? 'full_day') as AttendanceStatus,
    }));

    const errors: string[] = [];
    const dedup = new Map<string, ManualRequestRow>();
    const uniqueDaysByEmployee = new Map<string, Set<string>>();
    const dates: Date[] = [];

    for (const row of normalized) {
      if (!row.employeeName) errors.push('Employee name is required for all rows.');
      if (!row.dept) errors.push('Department is required for all rows.');
      if (!row.date) errors.push('Date is required for all rows.');
      if (!row.attendanceStatus) errors.push('Status is required for all rows.');

      const key = `${row.employeeName.toLowerCase()}|${row.date}`;
      const existing = dedup.get(key);

      const parsedDate = row.date ? new Date(row.date) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errors.push(`Invalid date: ${row.date}`);
      } else {
        dates.push(parsedDate);
      }

      const status = row.attendanceStatus;
      const requiresTime = status !== 'absent';
      if (requiresTime) {
        if (!row.timeIn) errors.push(`Time In is required for ${row.employeeName} on ${row.date}.`);
        if (!row.timeOut) errors.push(`Time Out is required for ${row.employeeName} on ${row.date}.`);
        if (row.totalHours === null || row.totalHours === undefined || Number.isNaN(Number(row.totalHours))) {
          errors.push(`Hours are required for ${row.employeeName} on ${row.date}.`);
        }
      }

      const daySet = uniqueDaysByEmployee.get(row.employeeName.toLowerCase()) ?? new Set<string>();
      if (daySet.has(row.date)) {
        errors.push(`Duplicate date ${row.date} for ${row.employeeName}. Each employee needs unique dates.`);
      }
      daySet.add(row.date);
      if (daySet.size > 20) {
        errors.push(`Timesheets support up to 20 days per employee. ${row.employeeName} exceeds this limit.`);
      }
      uniqueDaysByEmployee.set(row.employeeName.toLowerCase(), daySet);

      if (!existing || (row.totalHours ?? 0) > (existing.totalHours ?? 0)) {
        dedup.set(key, {
          ...row,
          timeIn: status === 'absent' ? null : row.timeIn,
          timeOut: status === 'absent' ? null : row.timeOut,
          totalHours: status === 'absent' ? null : row.totalHours,
        });
      }
    }

    if (errors.length) {
      return NextResponse.json({ ok: false, error: Array.from(new Set(errors)).join(' ') }, { status: 400 });
    }

    const dedupedRows = Array.from(dedup.values());
    if (!dedupedRows.length) {
      return NextResponse.json({ ok: false, error: 'No valid rows to save.' }, { status: 400 });
    }

    const employeeNames = [...new Set(dedupedRows.map((r) => r.employeeName))];

    // Validate against existing data: department consistency and duplicate employee/date in DB
    const existingRows = await prisma.timesheetRow.findMany({
      where: {
        employeeName: { in: employeeNames },
        date: { in: dedupedRows.map((r) => new Date(r.date)) },
      },
      select: { employeeName: true, dept: true, date: true },
    });

    const existingDeptMap = new Map<string, string>();
    const existingDateMap = new Map<string, Set<string>>();
    existingRows.forEach((row) => {
      if (row.dept && !existingDeptMap.has(row.employeeName)) {
        existingDeptMap.set(row.employeeName, row.dept);
      }
      const set = existingDateMap.get(row.employeeName) ?? new Set<string>();
      set.add(row.date.toISOString().slice(0, 10));
      existingDateMap.set(row.employeeName, set);
    });

    dedupedRows.forEach((row) => {
      const existingDept = existingDeptMap.get(row.employeeName);
      if (existingDept && row.dept && row.dept.trim().toLowerCase() !== existingDept.trim().toLowerCase()) {
        errors.push(`Department mismatch for ${row.employeeName}. Existing: ${existingDept}`);
      }
      if (existingDept && (!row.dept || !row.dept.trim())) {
        row.dept = existingDept;
      }
      const set = existingDateMap.get(row.employeeName);
      if (set && set.has(row.date)) {
        errors.push(`Duplicate date ${row.date} already exists for ${row.employeeName}.`);
      }
    });

    if (errors.length) {
      return NextResponse.json({ ok: false, error: Array.from(new Set(errors)).join(' ') }, { status: 400 });
    }

    const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const employeeNamesSet = [...new Set(dedupedRows.map((r) => r.employeeName))];

    const format = options.format ?? 'manual';
    const fileName = options.fileName ?? (format === 'manual' ? 'manual-entry' : 'upload');
    const entrySource = options.entrySource ?? (format === 'manual' ? 'manual' : 'upload');

    const timesheet = await prisma.$transaction(async (tx) => {
      const employees = await Promise.all(
        employeeNamesSet.map(async (name) => {
          const existing = await tx.employee.findFirst({ where: { employeeName: name } });
          if (existing) return existing;
          return tx.employee.create({ data: { employeeName: name } });
        })
      );

      const employeeMap = new Map(employees.map((emp) => [emp.employeeName, emp]));

      return tx.timesheet.create({
        data: {
          fileName: fileName ?? null,
          format,
          entrySource,
          startDate,
          endDate,
          totalRows: dedupedRows.length,
          rows: {
            create: dedupedRows.map((row) => {
              const employee = employeeMap.get(row.employeeName);
              const status = row.attendanceStatus ?? 'full_day';
              const totalHours = status === 'absent' ? null : row.totalHours ?? null;
              const timeIn = status === 'absent' ? null : row.timeIn ?? null;
              const timeOut = status === 'absent' ? null : row.timeOut ?? null;

              return {
                employeeName: row.employeeName,
                employeeId: employee?.id,
                date: new Date(row.date),
                dept: row.dept,
                beforeNoonIn: timeIn,
                beforeNoonOut: timeOut,
                totalHours,
                workHours: totalHours,
                attendanceStatus: status,
              };
            }),
          },
        },
        include: { rows: true },
      });
    });

    return NextResponse.json({
      ok: true,
      format: 'manual',
      warnings: [],
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      timesheetId: timesheet.id,
      rows: timesheet.rows.map(mapRowResponse),
    });
  } catch (error) {
    console.error('Failed to save manual timesheet:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to save manual timesheet' },
      { status: 500 }
    );
  }
}
