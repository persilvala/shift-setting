import { NextResponse } from "next/server";
import type { TimesheetMeta } from "@/lib/types";

type ExportPayload = {
  payroll?: Array<{
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
  }>;
  startDate?: string;
  endDate?: string;
  basePayPerDay?: number;
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

  const meta = payload.timesheetMeta ?? {};

  const headerRows: Array<Array<string | number | null | undefined>> = [
    ["Payroll period", `${payload.startDate} to ${payload.endDate}`],
    ["Base pay per day", money(payload.basePayPerDay)],
  ];

  if (meta.format) headerRows.push(["Source file type", meta.format.toUpperCase()]);
  if (meta.totalRows) headerRows.push(["Parsed rows", meta.totalRows]);
  if (meta.uploadedAt) headerRows.push(["Uploaded at", meta.uploadedAt]);
  headerRows.push(["Generated at", new Date().toISOString()]);
  headerRows.push([]);

  const tableHeader = [
    "Employee",
    "Start Date",
    "End Date",
    "Full Days",
    "Half Days",
    "Absent Days",
    "Base Pay/Day",
    "Base Pay",
    "Added (+)",
    "Subtracted (-)",
    "Net Pay",
  ];

  const dataRows = payload.payroll.map((entry) => [
    entry.employeeName,
    entry.startDate,
    entry.endDate,
    entry.attendanceDays,
    entry.halfDays,
    entry.absentDays,
    money(entry.basePayPerDay).toFixed(2),
    money(entry.basePay).toFixed(2),
    money(entry.addedValue).toFixed(2),
    money(entry.subtractedValue).toFixed(2),
    money(entry.netPay).toFixed(2),
  ]);

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
