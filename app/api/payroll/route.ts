import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { PayrollEntry } from "@/lib/types";

type PayrollEntryWithManual = PayrollEntry & {
  manualAddition?: number;
  manualDeduction?: number;
};

type SavePayrollRequest = {
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  overtimeRate: number;
  payroll: PayrollEntryWithManual[];
  timesheetId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavePayrollRequest;
    const {
      startDate,
      endDate,
      basePayPerDay,
      overtimeRate,
      payroll,
      timesheetId,
    } = body;

    // Calculate total net pay
    const totalNetPay = payroll.reduce((sum, entry) => {
      const manualAdd = entry.manualAddition ?? 0;
      const manualDeduct = entry.manualDeduction ?? 0;
      return sum + entry.netPay + manualAdd - manualDeduct;
    }, 0);

    // Create payroll record
    const createdPayroll = await prisma.payroll.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        basePayPerDay,
        overtimeRate,
        totalNetPay,
        entries: {
          create: payroll.map((entry) => ({
            employeeName: entry.employeeName,
            employeeUserId: entry.userId,
            department: entry.department,
            workDays: entry.workDays,
            workHours: entry.workHours,
            overtimeHours: entry.overtimeHours,
            basePay: entry.basePay,
            overtimePay: entry.overtimePay,
            totalAdditions: entry.totalAdditions,
            totalDeductions: entry.totalDeductions,
            netPay: entry.netPay,
            manualAddition: entry.manualAddition ?? 0,
            manualDeduction: entry.manualDeduction ?? 0,
          })),
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
