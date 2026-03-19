import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { AttendanceStatus } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: [{ date: 'asc' }, { employeeName: 'asc' }],
        },
      },
    });

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    }

    // Convert dates to strings for JSON serialization
    const serializedTimesheet = {
      ...timesheet,
      startDate: timesheet.startDate.toISOString(),
      endDate: timesheet.endDate.toISOString(),
      uploadedAt: timesheet.uploadedAt.toISOString(),
      rows: timesheet.rows.map(row => ({
        ...row,
        date: row.date.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ timesheet: serializedTimesheet });
  } catch (error) {
    console.error('Failed to fetch timesheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timesheet' },
      { status: 500 }
    );
  }
}

type IncomingRow = {
  employeeName: string;
  dept?: string | null;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  totalHours?: number | null;
  attendanceStatus?: AttendanceStatus;
};

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
    attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? 'full_day',
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const rows = (body?.rows ?? []) as IncomingRow[];

    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ ok: false, error: 'At least one row is required.' }, { status: 400 });
    }

    const timesheet = await prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) {
      return NextResponse.json({ ok: false, error: 'Timesheet not found.' }, { status: 404 });
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
    const dedup = new Map<string, IncomingRow>();
    const perEmployeeDates = new Map<string, Set<string>>();
    const dateList: Date[] = [];

    for (const row of normalized) {
      if (!row.employeeName) errors.push('Employee name is required for all rows.');
      if (!row.dept) errors.push('Department is required for all rows.');
      if (!row.date) errors.push('Date is required for all rows.');

      const parsedDate = row.date ? new Date(row.date) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
        errors.push(`Invalid date: ${row.date}`);
      } else {
        dateList.push(parsedDate);
      }

      const status = row.attendanceStatus;
      const needsTime = status !== 'absent';
      if (needsTime) {
        if (!row.timeIn) errors.push(`Time In is required for ${row.employeeName} on ${row.date}.`);
        if (!row.timeOut) errors.push(`Time Out is required for ${row.employeeName} on ${row.date}.`);
        if (row.totalHours === null || row.totalHours === undefined || Number.isNaN(Number(row.totalHours))) {
          errors.push(`Hours are required for ${row.employeeName} on ${row.date}.`);
        }
        if (row.totalHours !== null && row.totalHours !== undefined && Number(row.totalHours) < 0) {
          errors.push(`Hours cannot be negative for ${row.employeeName} on ${row.date}.`);
        }
      }

      const empKey = row.employeeName.toLowerCase();
      const daySet = perEmployeeDates.get(empKey) ?? new Set<string>();
      if (daySet.has(row.date)) {
        errors.push(`Duplicate date ${row.date} for ${row.employeeName}. Each employee needs unique dates.`);
      }
      daySet.add(row.date);
      if (daySet.size > 20) {
        errors.push(`Timesheets support up to 20 days per employee. ${row.employeeName} exceeds this limit.`);
      }
      perEmployeeDates.set(empKey, daySet);

      const key = `${empKey}|${row.date}`;
      const existing = dedup.get(key);
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

    const finalRows = Array.from(dedup.values());
    if (!finalRows.length) {
      return NextResponse.json({ ok: false, error: 'No valid rows to save.' }, { status: 400 });
    }

    const startDate = new Date(Math.min(...dateList.map((d) => d.getTime())));
    const endDate = new Date(Math.max(...dateList.map((d) => d.getTime())));

    const employeeNames = [...new Set(finalRows.map((r) => r.employeeName))];

    const result = await prisma.$transaction(async (tx) => {
      const employees = await Promise.all(
        employeeNames.map(async (name) => {
          const existing = await tx.employee.findFirst({ where: { employeeName: name } });
          if (existing) return existing;
          return tx.employee.create({ data: { employeeName: name } });
        })
      );
      const employeeMap = new Map(employees.map((emp) => [emp.employeeName, emp]));

      const keys = finalRows
        .map((row) => {
          const emp = employeeMap.get(row.employeeName);
          if (!emp?.id) return null;
          return { employeeId: emp.id, date: new Date(row.date) };
        })
        .filter(Boolean) as { employeeId: string; date: Date }[];

      const existingRows = keys.length
        ? await tx.timesheetRow.findMany({
            where: {
              OR: keys.map((k) => ({ employeeId: k.employeeId, date: k.date })),
            },
          })
        : [];

      const existingMap = new Map<string, (typeof existingRows)[number]>();
      existingRows.forEach((row) => {
        existingMap.set(`${row.employeeId}|${row.date.toISOString().slice(0, 10)}`, row);
      });

      const results: (typeof existingRows)[number][] = [];

      for (const row of finalRows) {
        const emp = employeeMap.get(row.employeeName);
        const status = row.attendanceStatus ?? 'full_day';
        const incomingHours = status === 'absent' ? 0 : Number(row.totalHours ?? 0);
        const key = `${emp?.id ?? ''}|${row.date}`;
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
              timesheetId: id,
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
              timesheetId: id,
              employeeName: row.employeeName,
              employeeId: emp?.id,
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

      await tx.timesheet.update({
        where: { id },
        data: {
          totalRows: results.length,
          startDate,
          endDate,
        },
      });

      const refreshedRows = await tx.timesheetRow.findMany({
        where: { timesheetId: id },
        orderBy: [{ date: 'asc' }, { employeeName: 'asc' }],
      });

      const updatedStart = refreshedRows.length
        ? new Date(Math.min(...refreshedRows.map((r) => r.date.getTime())))
        : startDate;
      const updatedEnd = refreshedRows.length
        ? new Date(Math.max(...refreshedRows.map((r) => r.date.getTime())))
        : endDate;

      return { rows: refreshedRows, startDate: updatedStart, endDate: updatedEnd, totalRows: refreshedRows.length };
    });

    return NextResponse.json({
      ok: true,
      format: timesheet.format as 'excel' | 'pdf' | 'manual',
      warnings: [],
      startDate: result.startDate.toISOString().slice(0, 10),
      endDate: result.endDate.toISOString().slice(0, 10),
      timesheetId: id,
      rows: result.rows.map(mapRowResponse),
    });
  } catch (error) {
    console.error('Failed to update timesheet:', error);
    return NextResponse.json({ ok: false, error: 'Failed to update timesheet' }, { status: 500 });
  }
}
