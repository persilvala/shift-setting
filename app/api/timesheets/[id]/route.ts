import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AttendanceStatus } from "@/lib/types";
import {
  upsertManualTimesheet,
  manualTimesheetMapper,
} from "@/lib/manualTimesheet";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: [{ date: "asc" }, { employeeName: "asc" }],
        },
      },
    });

    if (!timesheet) {
      return NextResponse.json(
        { error: "Timesheet not found" },
        { status: 404 },
      );
    }

    const serializedTimesheet = {
      ...timesheet,
      startDate: timesheet.startDate.toISOString(),
      endDate: timesheet.endDate.toISOString(),
      uploadedAt: timesheet.uploadedAt.toISOString(),
      rows: timesheet.rows.map((row) => ({
        ...row,
        date: row.date.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ timesheet: serializedTimesheet });
  } catch (error) {
    console.error("Failed to fetch timesheet:", error);
    return NextResponse.json(
      { error: "Failed to fetch timesheet" },
      { status: 500 },
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const rows = (body?.rows ?? []) as IncomingRow[];

    const result = await upsertManualTimesheet({ rows, timesheetId: id });

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
      timesheetId: id,
      rows: result.rows.map(manualTimesheetMapper.mapRowResponse),
    });
  } catch (error) {
    console.error("Failed to update timesheet:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update timesheet" },
      { status: 500 },
    );
  }
}
