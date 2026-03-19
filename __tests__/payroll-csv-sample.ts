// Generate sample payroll CSV output

type PayrollEntry = {
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

type TimesheetMeta = {
  format?: "excel" | "pdf";
  totalRows?: number;
  uploadedAt?: string;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

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

function generatePayrollCSV(
  payroll: PayrollEntry[],
  startDate: string,
  endDate: string,
  basePayPerDay: number,
  timesheetMeta?: TimesheetMeta
): string {
  const meta = timesheetMeta ?? {};

  const headerRows: Array<Array<string | number | null | undefined>> = [
    ["Payroll period", `${startDate} to ${endDate}`],
    ["Base pay per day", money(basePayPerDay)],
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

  const dataRows = payroll.map((entry) => [
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
  return csv;
}

// Sample payroll data
const samplePayroll: PayrollEntry[] = [
  {
    employeeId: "E001",
    employeeName: "John Doe",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    attendanceDays: 22,
    halfDays: 2,
    absentDays: 3,
    basePayPerDay: 1000,
    basePay: 23000,
    addedValue: 500,
    subtractedValue: 0,
    netPay: 23500,
  },
  {
    employeeId: "E002",
    employeeName: "Jane Smith",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    attendanceDays: 20,
    halfDays: 4,
    absentDays: 3,
    basePayPerDay: 1200,
    basePay: 26400,
    addedValue: 0,
    subtractedValue: 200,
    netPay: 26200,
  },
  {
    employeeId: "E003",
    employeeName: "Bob Johnson",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    attendanceDays: 24,
    halfDays: 0,
    absentDays: 3,
    basePayPerDay: 1000,
    basePay: 24000,
    addedValue: 1000,
    subtractedValue: 500,
    netPay: 24500,
  },
];

const sampleMeta: TimesheetMeta = {
  format: "excel",
  totalRows: 156,
  uploadedAt: "2025-01-31T10:30:00.000Z",
};

const csvOutput = generatePayrollCSV(samplePayroll, "2025-01-01", "2025-01-31", 1000, sampleMeta);

console.log("=== Sample Payroll CSV Output ===\n");
console.log(csvOutput);
console.log("\n=== End of CSV ===");
