import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AttendanceStatus, ParsedTimesheetRow } from "@/lib/types";

type RowForMap = {
  employeeName: string;
  date: Date;
  beforeNoonIn: string | null;
  beforeNoonOut: string | null;
  totalHours: number | null;
  workHours: number | null;
  dept: string | null;
  userId: string | null;
  employeeId: number | null;
  attendanceStatus: string;
};

function mapRow(row: RowForMap): ParsedTimesheetRow {
  return {
    employeeName: row.employeeName,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
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
    const employeeIdParam = url.searchParams.get("employeeId");
    const employeeName = url.searchParams.get("employeeName")?.trim();
    const employeeId = employeeIdParam ? Number(employeeIdParam) : null;
    const hasEmployeeId = Number.isFinite(employeeId);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5", 10), 20);

    if (!hasEmployeeId && !employeeName) {
      return NextResponse.json({ ok: false, error: "employeeId or employeeName is required" }, { status: 400 });
    }

    const employee = hasEmployeeId
      ? await prisma.employee.findUnique({ where: { id: employeeId! } })
      : await prisma.employee.findFirst({ where: { employeeName: employeeName ?? undefined } });

    if (!employee) {
      return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });
    }

    const whereClause = {
      OR: [{ employeeId: employee.id }, { employeeName: employee.employeeName }],
    };

    const totalTimesheets = await prisma.timesheet.count({
      where: {
        rows: { some: whereClause },
      },
    });

    const totalPages = Math.ceil(totalTimesheets / limit);
    const skip = (Math.max(1, page) - 1) * limit;

    const timesheets = await prisma.timesheet.findMany({
      where: {
        rows: { some: whereClause },
      },
      orderBy: { uploadedAt: "desc" },
      skip,
      take: limit,
      include: {
        rows: {
          where: whereClause,
          orderBy: { date: "asc" },
        },
      },
    });

    const mappedTimesheets = timesheets.map((timesheet) => ({
      id: timesheet.id,
      startDate: timesheet.startDate.toISOString().slice(0, 10),
      endDate: timesheet.endDate.toISOString().slice(0, 10),
      uploadedAt: timesheet.uploadedAt.toISOString(),
      rowCount: timesheet.rows.length,
      rows: timesheet.rows.map(mapRow),
    }));

    return NextResponse.json({
      ok: true,
      employee,
      timesheets: mappedTimesheets,
      pagination: {
        page,
        limit,
        total: totalTimesheets,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to load employee timesheet rows:", error);
    return NextResponse.json({ ok: false, error: "Failed to load timesheet rows" }, { status: 500 });
  }
}
