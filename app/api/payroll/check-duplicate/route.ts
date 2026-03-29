import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timesheetId = searchParams.get("timesheetId");

    if (!timesheetId) {
      return NextResponse.json({ exists: false });
    }

    const timesheetIdNum = Number(timesheetId);
    if (!Number.isFinite(timesheetIdNum)) {
      return NextResponse.json({ exists: false });
    }

    const existing = await prisma.payroll.findFirst({
      where: { timesheetId: timesheetIdNum },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        generatedAt: true,
        _count: { select: { entries: true } },
      },
    });

    return NextResponse.json({
      exists: !!existing,
      payroll: existing,
    });
  } catch (error) {
    console.error("Failed to check payroll duplicate:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicates" },
      { status: 500 },
    );
  }
}
