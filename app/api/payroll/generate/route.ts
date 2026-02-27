import { NextResponse } from "next/server";

export type PayrollEntry = {
  userId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  workDays: number;
  workHours: number;
  overtimeHours: number;
  basePayPerDay: number;
  basePay: number;
  overtimePay: number;
  additions: Array<{ description: string; amount: number }>;
  deductions: Array<{ description: string; amount: number }>;
  totalAdditions: number;
  totalDeductions: number;
  netPay: number;
};

type GeneratePayrollRequest = {
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  overtimeRatePerHour?: number;
  timesheetData: Array<{
    userId: string;
    employeeName: string;
    department: string;
    workHours: number;
    overtimeHours: number;
    workDays: string;
    lateMinutes: number;
    earlyMinutes: number;
    addPayNormal?: number;
    addPayOvertime?: number;
    addPayAllowance?: number;
    payrollDeduction?: number;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeneratePayrollRequest;
    const { startDate, endDate, basePayPerDay, timesheetData, overtimeRatePerHour = 0 } = body;

    const payroll: PayrollEntry[] = timesheetData.map((entry) => {
      // Parse work days from string like "5/1" (normal/actual) or "5/0"
      const workDaysMatch = entry.workDays?.match(/(\d+)\/(\d+)/);
      const workDays = workDaysMatch ? parseInt(workDaysMatch[1], 10) : 0;

      const basePay = workDays * basePayPerDay;
      const overtimePay = entry.overtimeHours * overtimeRatePerHour;

      const additions: PayrollEntry["additions"] = [];
      const deductions: PayrollEntry["deductions"] = [];

      // Add pay from Excel (Normal, Overtime, Allowance)
      if (entry.addPayNormal && entry.addPayNormal > 0) {
        additions.push({ description: "Add Pay (Normal)", amount: entry.addPayNormal });
      }
      if (entry.addPayOvertime && entry.addPayOvertime > 0) {
        additions.push({ description: "Add Pay (OT)", amount: entry.addPayOvertime });
      }
      if (entry.addPayAllowance && entry.addPayAllowance > 0) {
        additions.push({ description: "Allowance", amount: entry.addPayAllowance });
      }

      // Deductions from Excel
      if (entry.payrollDeduction && entry.payrollDeduction > 0) {
        deductions.push({ description: "Payroll Deduction", amount: entry.payrollDeduction });
      }

      const totalAdditions = additions.reduce((sum, a) => sum + a.amount, 0);
      const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

      const netPay = basePay + overtimePay + totalAdditions - totalDeductions;

      return {
        userId: entry.userId,
        employeeName: entry.employeeName,
        department: entry.department,
        startDate,
        endDate,
        workDays,
        workHours: entry.workHours,
        overtimeHours: entry.overtimeHours,
        basePayPerDay,
        basePay,
        overtimePay,
        additions,
        deductions,
        totalAdditions,
        totalDeductions,
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
