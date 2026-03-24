import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function normalizeEmployeeKey(id: unknown, name: string | null | undefined) {
  const source = id ?? name ?? "";
  const str = typeof source === "string" ? source : String(source);
  return str.trim().toLowerCase();
}

export async function GET() {
  try {
    const [employees, rows] = await Promise.all([
      prisma.employee.findMany({ orderBy: { employeeName: "asc" } }),
      prisma.timesheetRow.findMany({ select: { employeeId: true, employeeName: true, date: true } }),
    ]);

    const dayMap = new Map<string, Set<string>>();
    rows.forEach((row) => {
      const key = normalizeEmployeeKey(row.employeeId, row.employeeName);
      if (!key || !row.date) return;
      const set = dayMap.get(key) ?? new Set<string>();
      set.add(row.date.toISOString().slice(0, 10));
      dayMap.set(key, set);
    });

    const payload = employees.map((emp) => {
      const key = normalizeEmployeeKey(emp.id, emp.employeeName);
      const days = dayMap.get(key)?.size ?? 0;
      return { id: emp.id, employeeName: emp.employeeName, dayCount: days };
    });

    return NextResponse.json({ ok: true, employees: payload });
  } catch (error) {
    console.error("Failed to load employee summary:", error);
    return NextResponse.json({ ok: false, error: "Failed to load employees" }, { status: 500 });
  }
}
