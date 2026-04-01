import { NextResponse } from "next/server";
import type { AttendanceStatus } from "@/lib/types";

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
  date: string;
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
    const { basePayPerDay, attendanceData } = body;

    const byEmployeeDate = new Map<string, {
      employeeId: string;
      employeeName: string;
      date: string;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
    }>();

    attendanceData.forEach((entry) => {
      const key = `${entry.employeeId}-${entry.date}`;
      if (!byEmployeeDate.has(key)) {
        byEmployeeDate.set(key, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          date: entry.date,
          attendanceDays: 0,
          halfDays: 0,
          absentDays: 0,
        });
      }
      const emp = byEmployeeDate.get(key)!;
      switch (entry.attendanceStatus) {
        case "full_day":
          emp.attendanceDays = 1;
          break;
        case "half_day":
          emp.halfDays = 1;
          break;
        case "absent":
          emp.absentDays = 1;
          break;
      }
    });

    const payroll: PayrollEntryResult[] = Array.from(byEmployeeDate.values()).map((emp) => {
      const basePay = (emp.attendanceDays * basePayPerDay) + (emp.halfDays * basePayPerDay * 0.5);
      const netPay = basePay;

      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        date: emp.date,
        startDate: emp.date,
        endDate: emp.date,
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
