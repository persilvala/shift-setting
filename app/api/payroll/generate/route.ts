import { NextResponse } from "next/server";
import type { PayrollEntry, AttendanceStatus } from "@/lib/types";

export type { PayrollEntry } from "@/lib/types";

type AttendanceData = {
  employeeId: string;
  employeeName: string;
  date: string;
  attendanceStatus: AttendanceStatus;
};

type GeneratePayrollRequest = {
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  attendanceData: AttendanceData[];
};

type PayrollEntryResult = {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  attendanceDays: number;
  halfDays: number;
  absentDays: number;
  basePayPerDay: number;
  basePay: number;
  addedValue: number;
  subtractedValue: number;
  netPay: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeneratePayrollRequest;
    const { startDate, endDate, basePayPerDay, attendanceData } = body;

    const byEmployee = new Map<string, {
      employeeId: string;
      employeeName: string;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
    }>();

    attendanceData.forEach((entry) => {
      const key = entry.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          attendanceDays: 0,
          halfDays: 0,
          absentDays: 0,
        });
      }
      const emp = byEmployee.get(key)!;
      switch (entry.attendanceStatus) {
        case "full_day":
          emp.attendanceDays++;
          break;
        case "half_day":
          emp.halfDays++;
          break;
        case "absent":
          emp.absentDays++;
          break;
      }
    });

    const payroll: PayrollEntryResult[] = Array.from(byEmployee.values()).map((emp) => {
      const basePay = (emp.attendanceDays * basePayPerDay) + (emp.halfDays * basePayPerDay * 0.5);
      const netPay = basePay;

      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        startDate,
        endDate,
        attendanceDays: emp.attendanceDays,
        halfDays: emp.halfDays,
        absentDays: emp.absentDays,
        basePayPerDay,
        basePay: Math.round(basePay * 100) / 100,
        addedValue: 0,
        subtractedValue: 0,
        netPay: Math.round(netPay * 100) / 100,
      };
    });

    return NextResponse.json({ ok: true, payroll });
  } catch (error) {
    console.error("Payroll generation error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to generate payroll: ${message}` },
      { status: 500 }
    );
  }
}
