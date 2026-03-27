import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = {
  params: Promise<{ id: string; entryId: string }>;
};

function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

type UpdateEntryRequest = {
  attendanceDays?: number;
  halfDays?: number;
  absentDays?: number;
  basePay?: number;
  addedValue?: number;
  subtractedValue?: number;
  netPay?: number;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: payrollId, entryId } = await params;
    const payrollInt = parseId(payrollId);
    const entryInt = parseId(entryId);

    if (payrollInt === null || entryInt === null) {
      return NextResponse.json({ ok: false, error: "Invalid payroll or entry id" }, { status: 400 });
    }
    const body = (await request.json()) as UpdateEntryRequest;

    const existingEntry = await prisma.payrollEntry.findUnique({
      where: { id: entryInt },
      include: { payroll: true },
    });

    if (!existingEntry) {
      return NextResponse.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }

    const attendanceDays = body.attendanceDays ?? existingEntry.attendanceDays;
    const halfDays = body.halfDays ?? existingEntry.halfDays;
    const absentDays = body.absentDays ?? existingEntry.absentDays;
    const addedValue = body.addedValue ?? existingEntry.addedValue;
    const subtractedValue = body.subtractedValue ?? existingEntry.subtractedValue;

    const basePayPerDay = existingEntry.payroll.basePayPerDay;
    const originalBasePay = existingEntry.basePay;

    const isOnlyDaysUpdate = 
      body.attendanceDays !== undefined ||
      body.halfDays !== undefined ||
      body.absentDays !== undefined;

    let newBasePay: number;
    let newNetPay: number;

    if (isOnlyDaysUpdate && body.addedValue === undefined && body.subtractedValue === undefined) {
      newBasePay = originalBasePay;
      newNetPay = originalBasePay + addedValue - subtractedValue;
    } else {
      newBasePay = attendanceDays * basePayPerDay + halfDays * basePayPerDay * 0.5;
      newNetPay = newBasePay + addedValue - subtractedValue;
    }

    const updatedEntry = await prisma.payrollEntry.update({
      where: { id: entryInt },
      data: {
        attendanceDays,
        halfDays,
        absentDays,
        basePay: newBasePay,
        addedValue,
        subtractedValue,
        netPay: newNetPay,
        isEdited: true,
      },
    });

    await prisma.payroll.update({
      where: { id: payrollInt },
      data: { isEdited: true },
    });

    console.log("✓ Payroll entry updated:", {
      id: updatedEntry.id,
      employeeId: updatedEntry.employeeId,
      payrollId,
      isEdited: updatedEntry.isEdited,
    });

    return NextResponse.json({
      ok: true,
      entry: updatedEntry,
    });
  } catch (error) {
    console.error("Failed to update payroll entry:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to update entry: ${message}` },
      { status: 500 }
    );
  }
}
