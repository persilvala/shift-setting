import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payrollId = parseId(id);
    if (payrollId === null) {
      return NextResponse.json({ error: "Invalid payroll id" }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        entries: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!payroll) {
      return NextResponse.json(
        { error: "Payroll not found" },
        { status: 404 }
      );
    }

    const entriesWithEmployeeName = payroll.entries.map((entry) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      employeeName: entry.employee.employeeName,
      attendanceDays: entry.attendanceDays,
      halfDays: entry.halfDays,
      absentDays: entry.absentDays,
      basePay: entry.basePay,
      addedValue: entry.addedValue,
      subtractedValue: entry.subtractedValue,
      netPay: entry.netPay,
      isEdited: entry.isEdited,
    }));

    return NextResponse.json({
      payroll: {
        id: payroll.id,
        startDate: payroll.startDate.toISOString().split("T")[0],
        endDate: payroll.endDate.toISOString().split("T")[0],
        basePayPerDay: payroll.basePayPerDay,
        totalNetPay: payroll.totalNetPay,
        isEdited: payroll.isEdited,
        generatedAt: payroll.generatedAt.toISOString(),
        entries: entriesWithEmployeeName,
      },
    });
  } catch (error) {
    console.error("Failed to fetch payroll:", error);
    return NextResponse.json(
      { error: "Failed to fetch payroll" },
      { status: 500 }
    );
  }
}
