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

    const updatedEntry = await prisma.payrollEntry.update({
      where: { id: entryInt },
      data: {
        ...body,
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
