import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AttendanceStatus } from "@/lib/types";
import {
  upsertManualTimesheet,
  manualTimesheetMapper,
} from "@/lib/manualTimesheet";

export async function GET() {
  try {
    const timesheets = await prisma.timesheet.findMany({
      orderBy: { uploadedAt: "desc" },
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
    console.error("Failed to fetch timesheets:", error);
    return NextResponse.json(
      { error: "Failed to fetch timesheets" },
      { status: 500 },
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
    id: row.id,
    employeeName: row.employeeName,
    date:
      row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = (body?.rows ?? []) as any[];
    const options = (body ?? {}) as {
      fileName?: string | null;
      format?: string | null;
      entrySource?: string | null;
    };

    const result = await upsertManualTimesheet({
      rows,
      manualOptions: {
        fileName: options.fileName,
        format: options.format,
        entrySource: options.entrySource,
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status ?? 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      format: (result.format ?? "manual") as "excel" | "pdf" | "manual",
      warnings: [],
      startDate: result.startDate
        ? result.startDate.toISOString().slice(0, 10)
        : null,
      endDate: result.endDate
        ? result.endDate.toISOString().slice(0, 10)
        : null,
      timesheetId: result.timesheetId,
      rows: result.rows.map(manualTimesheetMapper.mapRowResponse),
    });
  } catch (error) {
    console.error("Failed to save manual timesheet:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save manual timesheet" },
      { status: 500 },
    );
  }
}
