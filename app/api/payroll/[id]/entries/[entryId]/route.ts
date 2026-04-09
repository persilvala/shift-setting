import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = {
  params: Promise<{ id: string; entryId: string }>;
};

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
    const body = (await request.json()) as UpdateEntryRequest;

    const updatedEntry = await prisma.payrollEntry.update({
      where: { id: entryId },
      data: {
        ...body,
        isEdited: true,
      },
    });

    await prisma.payroll.update({
      where: { id: payrollId },
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
