import { NextResponse } from "next/server";
import { dateRange, timesheetRows } from "@/lib/timesheetData";

export async function GET() {
  const header = [
    "Date Range:",
    dateRange,
  ];

  const columnHeader = [
    "User ID",
    "Name",
    "Department",
    "Mo",
    "Tu",
    "We",
    "Th",
    "Fr",
    "Sa",
    "Su",
  ];

  const rows = timesheetRows.map((row) => [
    row.id,
    row.name,
    row.dept,
    row.week.Mo,
    row.week.Tu,
    row.week.We,
    row.week.Th,
    row.week.Fr,
    row.week.Sa,
    row.week.Su,
  ]);

  const csv = [header, [], columnHeader, ...rows]
    .map((cols) =>
      cols
        .map((value) => {
          const cell = String(value ?? "");
          return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
        })
        .join(",")
    )
    .join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=timesheets.csv",
    },
  });
}
