import { NextResponse } from "next/server";
import type { PayrollEntry } from "@/app/api/payroll/generate/route";

type Adjustment = { addition?: number; deduction?: number };

type TimesheetMeta = {
  format?: "excel" | "pdf";
  totalRows?: number;
  uploadedAt?: string;
};

type ExportPayload = {
  payroll?: PayrollEntry[];
  startDate?: string;
  endDate?: string;
  basePayPerDay?: number;
  overtimeRatePerHour?: number;
  adjustments?: Record<string, Adjustment>;
  timesheetMeta?: TimesheetMeta | null;
};

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((cols) =>
      cols
        .map((value) => {
          if (value === null || value === undefined) return "";
          const cell = String(value);
          const escaped = cell.replace(/"/g, '""');
          return /[",\n]/.test(cell) ? `"${escaped}"` : escaped;
        })
        .join(",")
    )
    .join("\n");
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as ExportPayload;

  if (!payload.payroll?.length) {
    return NextResponse.json({ ok: false, error: "Payroll data is required" }, { status: 400 });
  }

  if (!payload.startDate || !payload.endDate || payload.basePayPerDay === undefined) {
    return NextResponse.json({ ok: false, error: "Missing payroll period or rates" }, { status: 400 });
  }

  const adjustments = payload.adjustments ?? {};
  const meta = payload.timesheetMeta ?? {};

  const headerRows: Array<Array<string | number | null | undefined>> = [
    ["Payroll period", `${payload.startDate} to ${payload.endDate}`],
    ["Base pay per day", money(payload.basePayPerDay)],
    ["Overtime rate per hour", money(payload.overtimeRatePerHour ?? 0)],
  ];

  if (meta.format) headerRows.push(["Source file type", meta.format.toUpperCase()]);
  if (meta.totalRows) headerRows.push(["Parsed rows", meta.totalRows]);
  if (meta.uploadedAt) headerRows.push(["Uploaded at", meta.uploadedAt]);
  headerRows.push(["Generated at", new Date().toISOString()]);
  headerRows.push([]);

  const tableHeader = [
    "User ID",
    "Employee",
    "Department",
    "Work days",
    "Work hours",
    "OT hours",
    "Base pay",
    "OT pay",
    "Auto additions",
    "Auto deductions",
    "Manual add",
    "Manual deduct",
    "Net pay",
    "Adjusted net",
  ];

  const dataRows = payload.payroll.map((entry) => {
    const adj = adjustments[entry.userId] ?? { addition: 0, deduction: 0 };
    const manualAdd = Number(adj.addition ?? 0) || 0;
    const manualDeduct = Number(adj.deduction ?? 0) || 0;
    const adjustedNet = money(entry.netPay + manualAdd - manualDeduct);

    return [
      entry.userId,
      entry.employeeName,
      entry.department,
      entry.workDays,
      entry.workHours,
      entry.overtimeHours,
      money(entry.basePay).toFixed(2),
      money(entry.overtimePay).toFixed(2),
      money(entry.totalAdditions).toFixed(2),
      money(entry.totalDeductions).toFixed(2),
      money(manualAdd).toFixed(2),
      money(manualDeduct).toFixed(2),
      money(entry.netPay).toFixed(2),
      adjustedNet.toFixed(2),
    ];
  });

  const csv = toCsv([...headerRows, tableHeader, ...dataRows]);
  const filename = `payroll-${payload.startDate}-to-${payload.endDate}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
