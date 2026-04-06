import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/actions/audit";

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { employeeName: "asc" },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeName, basePayPerDay } = body;

    if (!employeeName) {
      return NextResponse.json(
        { error: "Employee name is required" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        employeeName,
        basePayPerDay: basePayPerDay ? parseFloat(basePayPerDay) : undefined,
      },
    });

    await logAuditEvent({
      action: "Employee Created",
      description: `Created new employee "${employeeName}" with base pay ${basePayPerDay || 0}`,
      status: "Success",
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Failed to create employee:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create employee: ${message}` },
      { status: 500 }
    );
  }
}
