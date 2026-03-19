import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { AttendanceStatus } from '@/lib/types';

function mapRow(row: { [key: string]: any }) {
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
    attendanceStatus: (row.attendanceStatus as AttendanceStatus) ?? 'full_day',
  };
}

export async function GET() {
  try {
    const timesheet = await prisma.timesheet.findFirst({
      orderBy: { uploadedAt: 'desc' },
      include: {
        rows: { orderBy: [{ employeeName: 'asc' }, { date: 'asc' }] },
      },
    });

    if (!timesheet) {
      return NextResponse.json({ ok: true, timesheet: null, rows: [] });
    }

    const serializedTimesheet = {
      ...timesheet,
      startDate: timesheet.startDate.toISOString(),
      endDate: timesheet.endDate.toISOString(),
      uploadedAt: timesheet.uploadedAt.toISOString(),
    };

    return NextResponse.json({
      ok: true,
      timesheet: serializedTimesheet,
      rows: timesheet.rows.map(mapRow),
    });
  } catch (error) {
    console.error('Failed to load latest timesheet:', error);
    return NextResponse.json({ ok: false, error: 'Failed to load latest timesheet' }, { status: 500 });
  }
}
