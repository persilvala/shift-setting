import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PayrollEntryData = {
  employeeId: string;
  employeeName: string;
  attendanceDays: number;
  halfDays: number;
  absentDays: number;
  basePayPerDay: number | null;
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
  timesheetId?: string;
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
      employeeId: string;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
      basePay: number;
      addedValue: number;
      subtractedValue: number;
      netPay: number;
    }[] = [];

    for (const entry of payroll) {
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { id: entry.employeeId },
            { employeeName: entry.employeeName },
          ],
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
          employeeId: employee.id,
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

    const createdPayroll = await prisma.payroll.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        basePayPerDay,
        totalNetPay,
        timesheetId,
        entries: {
          create: entriesToCreate,
        },
      },
      include: {
        entries: true,
      },
    });

    console.log("✓ Payroll saved to DB:", {
      id: createdPayroll.id,
      period: `${startDate} to ${endDate}`,
      entryCount: createdPayroll.entries.length,
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
