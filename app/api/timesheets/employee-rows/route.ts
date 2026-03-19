import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AttendanceStatus } from "@/lib/types";

function mapRow(row: any) {
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");
    const employeeName = url.searchParams.get("employeeName");

    if (!employeeId && !employeeName) {
      return NextResponse.json({ ok: false, error: "employeeId or employeeName is required" }, { status: 400 });
    }

    const employee = employeeId
      ? await prisma.employee.findUnique({ where: { id: employeeId } })
      : await prisma.employee.findFirst({ where: { employeeName: employeeName ?? undefined } });

    if (!employee) {
      return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });
    }

    // Fetch latest timesheet for this employee (by uploadedAt desc) and all rows for that employee within it
    const latestTimesheet = await prisma.timesheet.findFirst({
      where: {
        rows: {
          some: {
            OR: [{ employeeId: employee.id }, { employeeName: employee.employeeName }],
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    if (!latestTimesheet) {
      return NextResponse.json({ ok: true, employee, rows: [], timesheet: null });
    }

    const rows = await prisma.timesheetRow.findMany({
      where: {
        timesheetId: latestTimesheet.id,
        OR: [{ employeeId: employee.id }, { employeeName: employee.employeeName }],
      },
      orderBy: [{ date: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      employee,
      rows: rows.map(mapRow),
      timesheet: {
        id: latestTimesheet.id,
        startDate: latestTimesheet.startDate.toISOString().slice(0, 10),
        endDate: latestTimesheet.endDate.toISOString().slice(0, 10),
        uploadedAt: latestTimesheet.uploadedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to load employee timesheet rows:", error);
    return NextResponse.json({ ok: false, error: "Failed to load timesheet rows" }, { status: 500 });
  }
}
