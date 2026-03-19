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
        if (row.totalHours !== null && row.totalHours !== undefined && Number(row.totalHours) < 0) {
          errors.push(`Hours cannot be negative for ${row.employeeName} on ${row.date}.`);
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

      const createdTimesheet = await tx.timesheet.create({
        data: {
          fileName: fileName ?? null,
          format,
          entrySource,
          startDate,
          endDate,
          totalRows: 0,
        },
      });

      const keyTuples = dedupedRows.map((row) => {
        const employee = employeeMap.get(row.employeeName);
        return {
          employeeId: employee?.id ?? '',
          date: new Date(row.date),
        };
      });

      const existingRows = keyTuples.length
        ? await tx.timesheetRow.findMany({
            where: {
              OR: keyTuples.map((k) => ({ employeeId: k.employeeId, date: k.date })),
            },
          })
        : [];

      const existingMap = new Map<string, typeof existingRows[number]>();
      existingRows.forEach((row) => {
        const key = `${row.employeeId}|${row.date.toISOString().slice(0, 10)}`;
        existingMap.set(key, row);
      });

      const results = [] as typeof existingRows;

      for (const row of dedupedRows) {
        const employee = employeeMap.get(row.employeeName);
        const status = row.attendanceStatus ?? 'full_day';
        const incomingHours = status === 'absent' ? 0 : Number(row.totalHours ?? 0);
        const key = `${employee?.id ?? ''}|${row.date}`;
        const existing = existingMap.get(key);

        const existingHours = existing ? Number(existing.totalHours ?? existing.workHours ?? 0) : 0;
        const totalHours = status === 'absent' ? null : existingHours + incomingHours;
        const dept = row.dept?.trim() || existing?.dept || null;
        const timeIn = status === 'absent' ? null : row.timeIn ?? existing?.beforeNoonIn ?? null;
        const timeOut = status === 'absent' ? null : row.timeOut ?? existing?.beforeNoonOut ?? null;

        if (existing) {
          const updated = await tx.timesheetRow.update({
            where: { id: existing.id },
            data: {
              timesheetId: createdTimesheet.id,
              dept,
              beforeNoonIn: timeIn,
              beforeNoonOut: timeOut,
              totalHours,
              workHours: totalHours,
              attendanceStatus: status,
            },
          });
          results.push(updated);
        } else {
          const created = await tx.timesheetRow.create({
            data: {
              timesheetId: createdTimesheet.id,
              employeeName: row.employeeName,
              employeeId: employee?.id,
              date: new Date(row.date),
              dept,
              beforeNoonIn: timeIn,
              beforeNoonOut: timeOut,
              totalHours,
              workHours: totalHours,
              attendanceStatus: status,
            },
          });
          results.push(created);
        }
      }

      const updatedTimesheet = await tx.timesheet.update({
        where: { id: createdTimesheet.id },
        data: {
          totalRows: results.length,
          startDate,
          endDate,
        },
      });

      return { timesheet: updatedTimesheet, rows: results };
    });

    return NextResponse.json({
      ok: true,
      format: 'manual',
      warnings: [],
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
       timesheetId: timesheet.timesheet.id,
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
