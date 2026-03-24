import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PayrollEntryData = {
  employeeId: string | number;
  employeeName: string;
  timesheetRowId: string;
  basePayPerDay: number | null;
  attendanceDays: number;
  halfDays: number;
  absentDays: number;
  basePay: number;
  addedValue: number;
  subtractedValue: number;
  netPay: number;
};

type SavePayrollRequest = {
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  payroll: PayrollEntryData[];
  timesheetId?: string | number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavePayrollRequest;
    const {
      startDate,
      endDate,
      basePayPerDay,
      payroll,
      timesheetId,
    } = body;

    const totalNetPay = payroll.reduce((sum, entry) => sum + entry.netPay, 0);

    const entriesToCreate: {
      employeeId: number;
      timesheetRowId: number | null;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
      basePay: number;
      addedValue: number;
      subtractedValue: number;
      netPay: number;
    }[] = [];

    for (const entry of payroll) {
      const numericEmpId = typeof entry.employeeId === "string" ? parseInt(entry.employeeId, 10) : entry.employeeId;
      const numericRowId = entry.timesheetRowId ? (typeof entry.timesheetRowId === "string" ? parseInt(entry.timesheetRowId, 10) : entry.timesheetRowId) : null;
      
        const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            Number.isNaN(numericEmpId) ? undefined : { id: numericEmpId },
            { employeeName: entry.employeeName },
          ].filter(Boolean) as any,
        },
      });

      if (employee) {
        if (entry.basePayPerDay !== null && entry.basePayPerDay !== undefined) {
          await prisma.employee.update({
            where: { id: employee.id },
            data: { basePayPerDay: entry.basePayPerDay },
          });
        }

        entriesToCreate.push({
          employeeId: Number(employee.id),
          timesheetRowId: numericRowId,
          attendanceDays: entry.attendanceDays,
          halfDays: entry.halfDays,
          absentDays: entry.absentDays,
          basePay: entry.basePay,
          addedValue: entry.addedValue,
          subtractedValue: entry.subtractedValue,
          netPay: entry.netPay,
        });
      }
    }

    if (entriesToCreate.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid employees found for payroll entries" },
        { status: 400 }
      );
    }

    console.log("✓ Payroll save request:", {
      timesheetId,
      startDate,
      endDate,
      entryCount: entriesToCreate.length,
    });

    const createdPayroll = await prisma.payroll.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        basePayPerDay,
        totalNetPay,
        timesheetId: timesheetId ? Number(timesheetId) as any : null,
        entries: {
          create: entriesToCreate as any,
        },
      },
      include: {
        entries: true,
      },
    }) as any;

    console.log("✓ Payroll saved to DB:", {
      id: createdPayroll.id,
      period: `${startDate} to ${endDate}`,
      entryCount: createdPayroll.entries?.length ?? entriesToCreate.length,
      totalNetPay: createdPayroll.totalNetPay,
      generatedAt: createdPayroll.generatedAt,
    });

    return NextResponse.json({
      ok: true,
      payroll: createdPayroll,
      employeesUpdated: entriesToCreate.length,
    });
  } catch (error) {
    console.error("Payroll save error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to save payroll: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const payrolls = await prisma.payroll.findMany({
      orderBy: { generatedAt: "desc" },
      include: {
        _count: { select: { entries: true } },
      },
    });

    return NextResponse.json({ payrolls });
  } catch (error) {
    console.error("Failed to fetch payrolls:", error);
    return NextResponse.json(
      { error: "Failed to fetch payrolls" },
      { status: 500 }
    );
  }
}
