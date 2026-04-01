import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type PayrollEntryData = {
  employeeId: string | number;
  employeeName: string;
  timesheetRowId: string | number | null;
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
  timesheetId?: string | number | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavePayrollRequest;
    const { startDate, endDate, basePayPerDay, payroll, timesheetId } = body;

    console.log("📥 Payroll save request received:", {
      timesheetId,
      startDate,
      endDate,
      basePayPerDay,
      entryCount: payroll?.length ?? 0,
    });

    if (!Array.isArray(payroll)) {
      return NextResponse.json(
        { ok: false, error: "Invalid payroll data: expected an array" },
        { status: 400 },
      );
    }

    const totalNetPay = payroll.reduce(
      (sum, entry) => sum + (entry.netPay ?? 0),
      0,
    );

    const entriesToCreate: Array<{
      employeeId: number;
      timesheetRowId: number | null;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
      basePay: number;
      addedValue: number;
      subtractedValue: number;
      netPay: number;
    }> = [];

    for (const entry of payroll) {
      // Validate required fields
      if (!entry.employeeId && !entry.employeeName) {
        console.warn(
          "⚠️ Skipping entry with no employeeId or employeeName:",
          entry,
        );
        continue;
      }

      const numericEmpId =
        typeof entry.employeeId === "string"
          ? parseInt(entry.employeeId, 10)
          : entry.employeeId;
      const numericRowId =
        entry.timesheetRowId != null && entry.timesheetRowId !== ""
          ? typeof entry.timesheetRowId === "string"
            ? parseInt(entry.timesheetRowId, 10)
            : entry.timesheetRowId
          : null;

      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            ...(Number.isNaN(numericEmpId) ? [] : [{ id: numericEmpId }]),
            { employeeName: entry.employeeName },
          ],
        },
      });

      if (employee) {
        if (entry.basePayPerDay != null) {
          await prisma.employee.update({
            where: { id: employee.id },
            data: { basePayPerDay: entry.basePayPerDay },
          });
        }

        entriesToCreate.push({
          employeeId: Number(employee.id),
          timesheetRowId: numericRowId,
          attendanceDays: entry.attendanceDays ?? 0,
          halfDays: entry.halfDays ?? 0,
          absentDays: entry.absentDays ?? 0,
          basePay: entry.basePay ?? 0,
          addedValue: entry.addedValue ?? 0,
          subtractedValue: entry.subtractedValue ?? 0,
          netPay: entry.netPay ?? 0,
        });
      } else {
        console.warn("⚠️ Employee not found:", {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
        });
      }
    }

    if (entriesToCreate.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid employees found for payroll entries" },
        { status: 400 },
      );
    }

    console.log("✓ Payroll entries to create:", entriesToCreate.length);

    const createdPayroll = await prisma.payroll.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        basePayPerDay,
        totalNetPay,
        timesheetId: timesheetId ? Number(timesheetId) : null,
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
    console.error("❌ Payroll save error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to save payroll: ${message}` },
      { status: 500 },
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
      { status: 500 },
    );
  }
}
