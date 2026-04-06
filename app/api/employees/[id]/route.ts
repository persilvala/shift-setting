import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/actions/audit";

type RouteParams = { params: Promise<{ id: string }> };

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const employeeId = parseId(id);
    if (employeeId === null) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Failed to fetch employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const employeeId = parseId(id);
    if (employeeId === null) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 });
    }
    const body = await request.json();
    const { employeeName, basePayPerDay } = body;

    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeName: employeeName !== undefined ? employeeName : undefined,
        basePayPerDay: basePayPerDay !== undefined ? (basePayPerDay ? parseFloat(basePayPerDay) : undefined) : undefined,
      },
    });

    const changes: string[] = [];
    if (employeeName !== undefined && employeeName !== existing.employeeName) {
      changes.push(`name: "${existing.employeeName}" → "${employeeName}"`);
    }
    if (basePayPerDay !== undefined && parseFloat(basePayPerDay) !== existing.basePayPerDay) {
      changes.push(`base pay: ${existing.basePayPerDay} → ${basePayPerDay}`);
    }

    await logAuditEvent({
      action: "Employee Updated",
      description: changes.length > 0
        ? `Updated employee "${existing.employeeName}": ${changes.join(", ")}`
        : `Updated employee "${existing.employeeName}"`,
      status: "Success",
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Failed to update employee:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update employee: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const employeeId = parseId(id);
    if (employeeId === null) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employeeName: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

    await logAuditEvent({
      action: "Employee Deleted",
      description: `Deleted employee "${employee.employeeName}"`,
      status: "Success",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to delete employee: ${message}` },
      { status: 500 }
    );
  }
}
