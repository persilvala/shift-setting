import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Count records in each table
    const [timesheetCount, timesheetRowCount, payrollCount, payrollEntryCount] = await Promise.all([
      prisma.timesheet.count(),
      prisma.timesheetRow.count(),
      prisma.payroll.count(),
      prisma.payrollEntry.count(),
    ]);

    // Get latest timesheet with summary
    const latestTimesheet = await prisma.timesheet.findFirst({
      orderBy: { uploadedAt: "desc" },
      include: {
        _count: { select: { rows: true } },
      },
    });

    // Get latest payroll with summary
    const latestPayroll = await prisma.payroll.findFirst({
      orderBy: { generatedAt: "desc" },
      include: {
        _count: { select: { entries: true } },
      },
    });

    // Get sample rows from latest timesheet
    const sampleTimesheetRows: { employeeName: string; date: Date; totalHours: number | null; workHours: number | null }[] = [];
    if (latestTimesheet) {
      const rows = await prisma.timesheetRow.findMany({
        where: { timesheetId: latestTimesheet.id },
        take: 5,
        select: {
          employeeName: true,
          date: true,
          totalHours: true,
          workHours: true,
        },
      });
      sampleTimesheetRows.push(...rows);
    }

    return NextResponse.json({
      ok: true,
      counts: {
        timesheets: timesheetCount,
        timesheetRows: timesheetRowCount,
        payrolls: payrollCount,
        payrollEntries: payrollEntryCount,
      },
      latest: {
        timesheet: latestTimesheet
          ? {
              id: latestTimesheet.id,
              fileName: latestTimesheet.fileName,
              format: latestTimesheet.format,
              uploadedAt: latestTimesheet.uploadedAt,
              rowCount: latestTimesheet._count.rows,
            }
          : null,
        payroll: latestPayroll
          ? {
              id: latestPayroll.id,
              startDate: latestPayroll.startDate,
              endDate: latestPayroll.endDate,
              generatedAt: latestPayroll.generatedAt,
              entryCount: latestPayroll._count.entries,
              totalNetPay: latestPayroll.totalNetPay,
            }
          : null,
      },
      sample: {
        timesheetRows: sampleTimesheetRows,
      },
    });
  } catch (error) {
    console.error("Database check error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
