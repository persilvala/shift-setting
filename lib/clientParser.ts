import * as XLSX from "xlsx";
import type { ParsedTimesheetRow, AttendanceStatus } from "@/lib/types";

export type ClientParseResult = {
  format: "excel" | "csv" | "pdf";
  rows: ParsedTimesheetRow[];
  warnings: string[];
  startDate?: string | null;
  endDate?: string | null;
  fileName: string;
};

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();

function excelSerialToDate(value: number): string | null {
  const ms = EXCEL_EPOCH + value * 24 * 60 * 60 * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

function parseHourValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.,-]/g, "");
    const normalized =
      cleaned.includes(",") && !cleaned.includes(".")
        ? cleaned.replace(",", ".")
        : cleaned;
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed)) {
      return Math.round(parsed * 100) / 100;
    }
  }

  return null;
}

function parseTimeValue(value: unknown): string | null {
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, "0");
    const m = String(value.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    if (Number.isNaN(totalMinutes)) return null;
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Try HH:MM format
    const match = trimmed.match(/^([0-2]?\d):([0-5]\d)$/);
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
    }

    // Try parsing as time
    const d = new Date(`2000-01-01 ${trimmed}`);
    if (!Number.isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
  }

  return null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isLikelyName(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[-0-9.\s]+$/.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  if (!/[a-z]/i.test(trimmed)) return false;
  return true;
}

const HEADER_MAP: Record<
  string,
  "employeeName" | "date" | "timeIn" | "timeOut" | "hours"
> = {
  name: "employeeName",
  "employee name": "employeeName",
  employee: "employeeName",
  "full name": "employeeName",
  "staff name": "employeeName",
  timein: "timeIn",
  timeout: "timeOut",
  clockin: "timeIn",
  clockout: "timeOut",
  date: "date",
  "work date": "date",
  "shift date": "date",
  "time in": "timeIn",
  in: "timeIn",
  "clock in": "timeIn",
  login: "timeIn",
  "time out": "timeOut",
  out: "timeOut",
  "clock out": "timeOut",
  logout: "timeOut",
  hours: "hours",
  "total hours": "hours",
  hrs: "hours",
  "total hrs": "hours",
};

function normalizeHeaderLabel(label: string): string {
  return label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function mapHeaderIndices(headers: (string | number | Date | undefined)[]) {
  const mapping: Partial<
    Record<"employeeName" | "date" | "timeIn" | "timeOut" | "hours", number>
  > = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeaderLabel(String(header ?? ""));
    const field = HEADER_MAP[normalized];
    if (field && mapping[field] === undefined) {
      mapping[field] = index;
    }
  });

  return mapping;
}

function findDateRange(rows: (string | number | Date | undefined)[][]): {
  startDate?: string;
  endDate?: string;
} {
  const datePattern = /(\d{4}-\d{2}-\d{2})/g;
  const dates: Date[] = [];

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const joined = rows[r].map(String).join(" ");
    const matches = joined.match(datePattern);
    if (matches) {
      matches.forEach((match) => {
        const d = new Date(match);
        if (!Number.isNaN(d.getTime())) {
          dates.push(d);
        }
      });
    }
  }

  if (dates.length === 0) return {};

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    startDate: minDate.toISOString().slice(0, 10),
    endDate: maxDate.toISOString().slice(0, 10),
  };
}

function findEmployeeMeta(rows: (string | number | Date | undefined)[][]): {
  name?: string;
  dept?: string;
  userId?: string;
} {
  const meta: { name?: string; dept?: string; userId?: string } = {};

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = String(rows[r][c] ?? "").toLowerCase();

      if (!meta.name && cell.includes("name")) {
        const nextCell = rows[r][c + 1];
        if (nextCell && isLikelyName(String(nextCell))) {
          meta.name = String(nextCell).trim();
        }
      }

      if (!meta.dept && cell.includes("dept")) {
        const nextCell = rows[r][c + 1];
        if (nextCell) {
          meta.dept = String(nextCell).trim();
        }
      }

      if (!meta.userId && cell.includes("user") && cell.includes("id")) {
        const nextCell = rows[r][c + 1];
        if (nextCell) {
          meta.userId = String(nextCell).trim();
        }
      }
    }
  }

  return meta;
}

export function parseExcelFileClient(
  arrayBuffer: ArrayBuffer,
  fileName: string,
): ClientParseResult {
  const warnings: string[] = [];
  const rows: ParsedTimesheetRow[] = [];

  try {
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

    if (wb.SheetNames.length === 0) {
      throw new Error("No sheets found in Excel file");
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: (string | number | Date | undefined)[][] =
      XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (data.length === 0) {
      throw new Error("Empty spreadsheet");
    }

    // Debug: log first few rows
    console.log("Excel data preview:", data.slice(0, 5));

    // Detect shift code template format (User ID, Name, Dept, then day numbers)
    const hasShiftCodeFormat = data.some((row, i) => {
      if (i > 5) return false;
      const rowStr = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
      return (
        rowStr.includes("user id") &&
        rowStr.includes("name") &&
        rowStr.includes("department")
      );
    });

    if (hasShiftCodeFormat) {
      // This is a shift code template - throw special error to fallback to server-side parsing
      throw new Error("SHIFT_CODE_TEMPLATE");
    }

    // Find header row - be more flexible
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(data.length, 30); i++) {
      const rowText = data[i]
        .map((c) => normalizeHeaderLabel(String(c ?? "")))
        .join(" ");
      // Look for common header patterns
      if (
        rowText.includes("name") ||
        rowText.includes("date") ||
        rowText.includes("time") ||
        rowText.includes("hours")
      ) {
        headerRowIndex = i;
        break;
      }
    }

    const headerRow = data[headerRowIndex] ?? [];
    const headerIndices = mapHeaderIndices(headerRow);

    console.log("Header row:", headerRow);
    console.log("Header indices:", headerIndices);

    // Check for required fields - give more specific error
    if (
      headerIndices.employeeName === undefined &&
      headerIndices.date === undefined
    ) {
      throw new Error(
        `Could not find employee name or date columns. Detected headers: ${headerRow.map((h) => `"${h}"`).join(", ")}. ` +
          "Please ensure your file has columns with headers like 'Name', 'Employee', 'Date', 'Time In', 'Time Out'.",
      );
    }

    if (headerIndices.employeeName === undefined) {
      warnings.push(
        "Could not auto-detect employee name column. Using first non-empty cell as name.",
      );
    }

    if (headerIndices.date === undefined) {
      warnings.push(
        "Could not auto-detect date column. Please ensure your file has a 'Date' column.",
      );
    }

    // Extract meta information
    const meta = findEmployeeMeta(data.slice(0, headerRowIndex + 5));
    const dateRange = findDateRange(data);

    console.log("Meta:", meta);
    console.log("Date range:", dateRange);

    // Parse data rows
    for (let r = headerRowIndex + 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.every((c) => !c)) continue;

      let employeeName =
        headerIndices.employeeName !== undefined
          ? stringOrNull(row[headerIndices.employeeName])
          : (meta.name ?? null);

      // If still no name, try first non-empty cell that looks like a name
      if (!employeeName) {
        for (let c = 0; c < row.length; c++) {
          const val = stringOrNull(row[c]);
          if (val && isLikelyName(val)) {
            employeeName = val;
            break;
          }
        }
      }

      const date =
        headerIndices.date !== undefined
          ? parseDateValue(row[headerIndices.date])
          : null;

      const timeIn =
        headerIndices.timeIn !== undefined
          ? parseTimeValue(row[headerIndices.timeIn])
          : null;

      const timeOut =
        headerIndices.timeOut !== undefined
          ? parseTimeValue(row[headerIndices.timeOut])
          : null;

      const totalHours =
        headerIndices.hours !== undefined
          ? parseHourValue(row[headerIndices.hours])
          : null;

      // Skip rows without employee name or date
      if (!employeeName || !date) continue;

      // Clean up employee name
      employeeName = employeeName.trim();

      rows.push({
        employeeName,
        date,
        timeIn,
        timeOut,
        totalHours,
        issues: [],
        sourceLine: r + 1,
        dept: meta.dept ?? null,
        userId: meta.userId ?? null,
        attendanceStatus: "full_day" as AttendanceStatus,
      });
    }

    console.log(`Parsed ${rows.length} rows`);

    if (rows.length === 0) {
      throw new Error(
        "No valid timesheet rows found. " +
          `Checked ${data.length - headerRowIndex - 1} data rows. ` +
          "Please check that your file has employee names and dates in a recognized format.",
      );
    }

    return {
      format: fileName.endsWith(".csv") ? "csv" : "excel",
      rows,
      warnings,
      startDate: dateRange.startDate ?? null,
      endDate: dateRange.endDate ?? null,
      fileName,
    };
  } catch (error) {
    console.error("Client-side Excel parsing error:", error);
    throw error;
  }
}

export function parseCsvFileClient(
  text: string,
  fileName: string,
): ClientParseResult {
  const warnings: string[] = [];
  const rows: ParsedTimesheetRow[] = [];

  try {
    // Simple CSV parsing (handles basic cases)
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("Empty CSV file");
    }

    // Parse header
    const headerLine = lines[0];
    const headers = headerLine
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));
    const headerIndices = mapHeaderIndices(headers);

    if (
      headerIndices.employeeName === undefined ||
      headerIndices.date === undefined
    ) {
      warnings.push("Could not auto-detect employee name or date columns.");
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(",")
        .map((v) => v.trim().replace(/^"|"$/g, ""));

      const employeeName =
        headerIndices.employeeName !== undefined
          ? values[headerIndices.employeeName] || null
          : null;

      const date =
        headerIndices.date !== undefined
          ? parseDateValue(values[headerIndices.date])
          : null;

      const timeIn =
        headerIndices.timeIn !== undefined
          ? parseTimeValue(values[headerIndices.timeIn])
          : null;

      const timeOut =
        headerIndices.timeOut !== undefined
          ? parseTimeValue(values[headerIndices.timeOut])
          : null;

      const totalHours =
        headerIndices.hours !== undefined
          ? parseHourValue(values[headerIndices.hours])
          : null;

      if (!employeeName || !date) continue;

      rows.push({
        employeeName: employeeName.trim(),
        date,
        timeIn,
        timeOut,
        totalHours,
        issues: [],
        sourceLine: i + 1,
        attendanceStatus: "full_day" as AttendanceStatus,
      });
    }

    if (rows.length === 0) {
      throw new Error("No valid timesheet rows found in CSV.");
    }

    return {
      format: "csv",
      rows,
      warnings,
      fileName,
    };
  } catch (error) {
    console.error("Client-side CSV parsing error:", error);
    throw error;
  }
}
