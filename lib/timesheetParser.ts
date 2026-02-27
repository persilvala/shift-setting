import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

export type ParsedTimesheetRow = {
  employeeName: string;
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  issues: string[];
  sourceLine: number;
  sheetName?: string;
  weekday?: string | null;
  dept?: string | null;
  userId?: string | null;
  template?: string | null;
  raw?: string[];
  // Payroll fields
  workHours?: number | null;
  workHoursActual?: number | null;
  overtimeHours?: number | null;
  overtimeHoliday?: number | null;
  lateCount?: number | null;
  lateMinutes?: number | null;
  earlyCount?: number | null;
  earlyMinutes?: number | null;
  workDays?: string | null;
  tripDays?: number | null;
  absenceDays?: number | null;
  leaveDays?: number | null;
  shiftCode?: string | null;
  // Additional pay fields
  addPayNormal?: number | null;
  addPayOvertime?: number | null;
  addPayAllowance?: number | null;
  leavePayLateEarly?: number | null;
  leavePayNoPaid?: number | null;
  payrollDeduction?: number | null;
  remark?: string | null;
};

type NormalizedField = "employeeName" | "date" | "timeIn" | "timeOut" | "hours";

type ParseResult = {
  format: "excel" | "pdf";
  rows: ParsedTimesheetRow[];
  warnings: string[];
};

const HEADER_MAP: Record<string, NormalizedField> = {
  name: "employeeName",
  "employee name": "employeeName",
  employee: "employeeName",
  "full name": "employeeName",
  "staff name": "employeeName",
  "team member": "employeeName",

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
  "hrs": "hours",
  "total hrs": "hours",
};

const REQUIRED_FIELDS: NormalizedField[] = ["employeeName", "date"];

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();

function normalizeHeaderLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function mapHeaderIndices(headers: (string | number | Date | undefined)[]) {
  const mapping: Partial<Record<NormalizedField, number>> = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeaderLabel(String(header ?? ""));
    const field = HEADER_MAP[normalized];
    if (field && mapping[field] === undefined) {
      mapping[field] = index;
    }
  });

  return mapping;
}

function excelSerialToDate(value: number) {
  const ms = EXCEL_EPOCH + value * 24 * 60 * 60 * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = excelSerialToDate(value);
    if (date) return date.toISOString().slice(0, 10);
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

function parseHoursValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.,-]/g, "");
    const normalized = cleaned.includes(",") && !cleaned.includes(".")
      ? cleaned.replace(",", ".")
      : cleaned;
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed)) {
      return Math.round(parsed * 100) / 100;
    }
  }

  return null;
}

function minutesToLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.abs(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTimeToMinutes(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel stores times as a fraction of a day.
    const minutes = Math.round((value % 1) * 24 * 60);
    if (!Number.isNaN(minutes)) return minutes;

    const date = excelSerialToDate(value);
    if (date) return date.getHours() * 60 + date.getMinutes();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      if (numeric > 24) return null;
      return Math.round(numeric * 60);
    }

    const match = trimmed.match(/^([0-2]?\d):([0-5]\d)(?:\s*([AP]M))?$/i);
    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
  }

  return null;
}

function formatDateFromDay(start: Date | null, day: number | null) {
  if (!start || day === null) return null;
  const date = new Date(start);
  date.setDate(start.getDate() + day - 1);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function detectAttendanceTemplate(lines: string[]) {
  const title = lines.some((line) => /employee attendance table/i.test(line));
  const timeCard = lines.some((line) => /before\s+noon/i.test(line));
  return title && timeCard;
}

function parseHeaderMeta(lines: string[]) {
  let name: string | null = null;
  let userId: string | null = null;
  let dept: string | null = null;
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let dateRangeLabel: string | null = null;

  const rangeLine = lines.find((line) => /(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})/.test(line));
  if (rangeLine) {
    const match = rangeLine.match(/(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      startDate = parseIsoDate(match[1]);
      endDate = parseIsoDate(match[2]);
      dateRangeLabel = `${match[1]}~${match[2]}`;
    }
  }

  const nameLine = lines.find((line) => /name/i.test(line) && /user\s*id/i.test(line));
  if (nameLine) {
    const idMatch = nameLine.match(/user\s*id\s*([A-Za-z0-9-]+)/i);
    if (idMatch) userId = idMatch[1];
    const nameMatch = nameLine.match(/name\s+(.+?)(?:\s+user\s*id|$)/i);
    if (nameMatch) name = nameMatch[1].trim();
  } else {
    const line = lines.find((l) => /name/i.test(l));
    const match = line?.match(/name\s+(.+)/i);
    if (match) name = match[1].trim();
  }

  const deptLine = lines.find((line) => /dept/i.test(line));
  if (deptLine) {
    const match = deptLine.match(/dept\.?\s*([A-Za-z0-9-]+)/i);
    if (match) dept = match[1];
  }

  return { name, userId, dept, startDate, endDate, dateRangeLabel };
}

function parseAttendanceRow(
  line: string,
  index: number,
  meta: ReturnType<typeof parseHeaderMeta>
): ParsedTimesheetRow | null {
  const match = line.match(/^\s*(\d{1,2})\s+(Mo|Tu|We|Th|Fr|Sa|Su)\b(.*)$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const weekday = match[2];
  const remainder = match[3].trim();
  const tokens = remainder ? remainder.split(/\s+/).filter(Boolean).slice(0, 6) : [];
  const [bnIn, bnOut, anIn, anOut, otIn, otOut] = tokens;

  const raw = [bnIn, bnOut, anIn, anOut, otIn, otOut].map((v) => v ?? "");

  const timeInCandidate = [bnIn, anIn, otIn].find((v) => !!v) ?? null;
  const outs = [bnOut, anOut, otOut].filter((v) => !!v);
  const timeOutCandidate = outs.length ? outs[outs.length - 1] : null;

  const timeInMinutes = parseTimeToMinutes(timeInCandidate);
  const timeOutMinutes = parseTimeToMinutes(timeOutCandidate);

  const timeIn = timeInMinutes !== null ? minutesToLabel(timeInMinutes) : null;
  const timeOut = timeOutMinutes !== null ? minutesToLabel(timeOutMinutes) : null;

  let totalHours: number | null = null;
  if (timeInMinutes !== null && timeOutMinutes !== null) {
    const durationMinutes = timeOutMinutes >= timeInMinutes
      ? timeOutMinutes - timeInMinutes
      : 24 * 60 - (timeInMinutes - timeOutMinutes);
    totalHours = Math.round((durationMinutes / 60) * 100) / 100;
  }

  const issues: string[] = [];
  if (!timeIn && !timeOut) issues.push("Missing time in/out");
  if (timeIn && !timeOut) issues.push("Missing time out");
  if (timeOut && !timeIn) issues.push("Missing time in");
  if (timeInCandidate && timeInMinutes === null) issues.push("Invalid time in format");
  if (timeOutCandidate && timeOutMinutes === null) issues.push("Invalid time out format");

  const date = formatDateFromDay(meta.startDate ?? null, Number.isNaN(day) ? null : day);
  if (!date) issues.push("Missing or invalid date");
  if (date && meta.endDate && new Date(date) > meta.endDate) {
    issues.push("Date outside range");
  }

  return {
    employeeName: meta.name ?? "",
    date,
    timeIn,
    timeOut,
    totalHours,
    issues,
    sourceLine: index + 1,
    weekday,
    dept: meta.dept ?? null,
    userId: meta.userId ?? null,
    template: "attendance-table",
    raw,
  };
}

function parseAttendanceTemplatePdf(lines: string[]): ParseResult | null {
  if (!detectAttendanceTemplate(lines)) return null;
  const meta = parseHeaderMeta(lines);
  const warnings: string[] = [];
  if (!meta.startDate) warnings.push("Missing date range start");

  const rows: ParsedTimesheetRow[] = [];
  lines.forEach((line, idx) => {
    const parsed = parseAttendanceRow(line, idx, meta);
    if (parsed) rows.push(parsed);
  });

  if (!rows.length) return null;
  return { format: "pdf", rows, warnings };
}

function parseSheetMeta(
  rows: (string | number | Date | undefined)[][],
  columnRange?: { start: number; end: number }
) {
  let name: string | null = null;
  let userId: string | null = null;
  let dept: string | null = null;
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  const datePattern = /(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})/;

  const inRange = (col: number) => {
    if (!columnRange) return true;
    return col >= columnRange.start && col <= columnRange.end;
  };

  const nextNonEmptyInRow = (row: (string | number | Date | undefined)[], start: number) => {
    for (let c = start; c < Math.min(row.length, start + 6); c += 1) {
      if (!inRange(c)) continue;
      const val = stringOrNull(row[c]);
      if (val) return val;
    }
    return null;
  };

  const belowNonEmpty = (rowIdx: number, colIdx: number) => {
    for (let r = rowIdx + 1; r <= rowIdx + 3 && r < rows.length; r += 1) {
      const val = stringOrNull(rows[r][colIdx]);
      if (val) return val;
    }
    return null;
  };

  for (let r = 0; r < Math.min(rows.length, 12); r += 1) {
    const row = rows[r];
    const limitedRow = columnRange
      ? row.map((cell, idx) => (inRange(idx) ? cell : undefined))
      : row;
    const joined = limitedRow.map(stringOrNull).filter(Boolean).join(" ");
    if (!startDate) {
      const m = joined.match(datePattern);
      if (m) {
        startDate = parseIsoDate(m[1]);
        endDate = parseIsoDate(m[2]);
      }
    }

    for (let c = 0; c < row.length; c += 1) {
      if (!inRange(c)) continue;
      const cell = stringOrNull(row[c]);
      const next = stringOrNull(row[c + 1]);
      if (!cell) continue;
      const lower = cell.toLowerCase();

      if (!name && lower.includes("name")) {
        name = next ?? nextNonEmptyInRow(row, c + 1) ?? belowNonEmpty(r, c) ?? name;
      }
      if (!userId && lower.includes("user") && lower.includes("id")) {
        userId = next ?? nextNonEmptyInRow(row, c + 1) ?? belowNonEmpty(r, c) ?? userId;
      }
      if (!dept && lower.startsWith("dept")) {
        const cleaned = cell.replace(/dept[:.]?/i, "").trim();
        dept = next ?? nextNonEmptyInRow(row, c + 1) ?? belowNonEmpty(r, c) ?? (cleaned ? cleaned : null);
      }
      if (!startDate && datePattern.test(cell)) {
        const m = cell.match(datePattern);
        if (m) {
          startDate = parseIsoDate(m[1]);
          endDate = parseIsoDate(m[2]);
        }
      }
    }
  }

  // Fallback: some templates have "Name <value>" in the same cell or two columns apart (row ~4)
  if (!name) {
    for (let r = 0; r <= 6 && r < rows.length; r += 1) {
      for (let c = columnRange ? columnRange.start : 0; c <= (columnRange ? columnRange.end : rows[r].length - 1); c += 1) {
        if (!inRange(c)) continue;
        const cell = stringOrNull(rows[r][c]);
        if (!cell) continue;
        const lower = cell.toLowerCase();
        const nameInline = cell.match(/name\s+(.+)/i);
        if (nameInline && nameInline[1]) {
          name = nameInline[1].trim();
          break;
        }
        if (lower === "name") {
          const next = stringOrNull(rows[r][c + 1]) || stringOrNull(rows[r][c + 2]);
          if (next) {
            name = next;
            break;
          }
        }
      }
      if (name) break;
    }
  }

  if (!userId) {
    for (let r = 0; r <= 6 && r < rows.length; r += 1) {
      for (let c = columnRange ? columnRange.start : 0; c <= (columnRange ? columnRange.end : rows[r].length - 1); c += 1) {
        if (!inRange(c)) continue;
        const cell = stringOrNull(rows[r][c]);
        if (!cell) continue;
        const lower = cell.toLowerCase();
        const idInline = cell.match(/user\s*id\s*([A-Za-z0-9-]+)/i);
        if (idInline && idInline[1]) {
          userId = idInline[1];
          break;
        }
        if (lower === "user id" || lower === "userid") {
          const next = stringOrNull(rows[r][c + 1]) || stringOrNull(rows[r][c + 2]);
          if (next) {
            userId = next;
            break;
          }
        }
      }
      if (userId) break;
    }
  }

  return { name, userId, dept, startDate, endDate };
}

function parseAttendanceSheetRow(
  row: (string | number | Date | undefined)[],
  index: number,
  meta: ReturnType<typeof parseSheetMeta>
): ParsedTimesheetRow | null {
  if (!row.length) return null;

  const first = stringOrNull(row[0]);
  const second = stringOrNull(row[1]);

  let day: number | null = null;
  let weekday: string | null = null;
  let weekdayInSeparateCol = false;

  if (first && /^\d{1,2}\s+[A-Za-z]{2}/.test(first)) {
    const m = first.match(/^(\d{1,2})\s+([A-Za-z]{2})/);
    if (m) {
      day = Number(m[1]);
      weekday = m[2];
      weekdayInSeparateCol = false;
    }
  } else {
    if (typeof row[0] === "number") day = row[0];
    else if (first && /^\d{1,2}$/.test(first)) day = Number(first);
    if (second && /^[A-Za-z]{2}$/.test(second)) {
      weekday = second;
      weekdayInSeparateCol = true;
    }
  }

  const baseCol = weekdayInSeparateCol ? 2 : 1;
  const bnIn = stringOrNull(row[baseCol]);
  const bnOut = stringOrNull(row[baseCol + 1]);
  const anIn = stringOrNull(row[baseCol + 2]);
  const anOut = stringOrNull(row[baseCol + 3]);
  const otIn = stringOrNull(row[baseCol + 4]);
  const otOut = stringOrNull(row[baseCol + 5]);

  const raw = [bnIn, bnOut, anIn, anOut, otIn, otOut].map((v) => v ?? "");

  const hasAnyTime = [bnIn, bnOut, anIn, anOut, otIn, otOut].some((v) => v && v.trim() !== "");
  if (day === null && !hasAnyTime) {
    return null;
  }

  if (day === null || !Number.isFinite(day) || day < 1 || day > 31) {
    return null;
  }
  const timeInCandidate = [bnIn, anIn, otIn].find((v) => !!v) ?? null;
  const outs = [bnOut, anOut, otOut].filter((v) => !!v);
  const timeOutCandidate = outs.length ? outs[outs.length - 1] : null;

  const timeInMinutes = parseTimeToMinutes(timeInCandidate);
  const timeOutMinutes = parseTimeToMinutes(timeOutCandidate);

  const timeIn = timeInMinutes !== null ? minutesToLabel(timeInMinutes) : null;
  const timeOut = timeOutMinutes !== null ? minutesToLabel(timeOutMinutes) : null;

  let totalHours: number | null = null;
  if (timeInMinutes !== null && timeOutMinutes !== null) {
    const durationMinutes = timeOutMinutes >= timeInMinutes
      ? timeOutMinutes - timeInMinutes
      : 24 * 60 - (timeInMinutes - timeOutMinutes);
    totalHours = Math.round((durationMinutes / 60) * 100) / 100;
  }

  const issues: string[] = [];
  if (!timeIn && !timeOut) issues.push("Missing time in/out");
  if (timeIn && !timeOut) issues.push("Missing time out");
  if (timeOut && !timeIn) issues.push("Missing time in");
  if (timeInCandidate && timeInMinutes === null) issues.push("Invalid time in format");
  if (timeOutCandidate && timeOutMinutes === null) issues.push("Invalid time out format");

  const date = formatDateFromDay(meta.startDate, day);
  if (!date) issues.push("Missing or invalid date");
  if (date && meta.endDate && new Date(date) > meta.endDate) {
    issues.push("Date outside range");
  }

  return {
    employeeName: meta.name ?? "",
    date,
    timeIn,
    timeOut,
    totalHours,
    issues,
    sourceLine: index + 1,
    weekday: weekday ?? null,
    dept: meta.dept ?? null,
    userId: meta.userId ?? null,
    template: "attendance-table",
    raw,
  };
}

// Parse Attendance Statistic Table (has payroll data: work hours, OT, late, early, etc.)
function parseAttendanceStatisticTable(rows: (string | number | Date | undefined)[][]): ParseResult | null {
  // Find header row with "User ID" or "Name" to detect column positions
  const headerIndex = rows.findIndex((row) => {
    const text = row.map((cell) => stringOrNull(cell)).filter(Boolean).join(" ").toLowerCase();
    return text.includes("worktime") || text.includes("overtime") || text.includes("late");
  });

  if (headerIndex === -1) return null;

  const meta = parseSheetMeta(rows);
  const warnings: string[] = [];
  if (!meta.startDate) warnings.push("Missing date range start");

  // Detect column positions from header row
  const headerRow = rows[headerIndex];
  let userIdCol = 0;
  let nameCol = 1;
  let deptCol = 2;
  
  headerRow.forEach((cell, idx) => {
    const str = stringOrNull(cell)?.toLowerCase();
    if (str?.includes("user") && str?.includes("id")) userIdCol = idx;
    if (str === "name") nameCol = idx;
    if (str?.includes("dept") || str?.includes("department")) deptCol = idx;
  });

  // Find sub-header row for detailed columns
  const subHeaderIndex = rows.findIndex((row, idx) =>
    idx > headerIndex && row.some((cell) => {
      const str = stringOrNull(cell);
      return str && (str.includes("Normal") || str.includes("Actual") || str.includes("Trip"));
    })
  );

  const parsed: ParsedTimesheetRow[] = [];
  // Data starts after the sub-header row (if exists) or after the main header
  const dataStartIndex = subHeaderIndex > headerIndex ? subHeaderIndex + 1 : headerIndex + 1;

  for (let i = dataStartIndex; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.some((cell) => stringOrNull(cell))) continue;

    const userId = stringOrNull(row[userIdCol]);
    const name = stringOrNull(row[nameCol]);
    const dept = stringOrNull(row[deptCol]);

    // Column indices based on template: Worktime(Normal), Worktime(Actual), Late(Times), Late(Minute),
    // Early(Times), Early(Minute), Overtime(Normal), Overtime(Holiday), Workday, Trip, Absence, Leave
    const workHours = typeof row[3] === "number" ? row[3] : null;
    const workHoursActual = typeof row[4] === "number" ? row[4] : null;
    const lateCount = typeof row[5] === "number" ? row[5] : null;
    const lateMinutes = typeof row[6] === "number" ? row[6] : null;
    const earlyCount = typeof row[7] === "number" ? row[7] : null;
    const earlyMinutes = typeof row[8] === "number" ? row[8] : null;
    const overtimeHours = typeof row[9] === "number" ? row[9] : null;
    const overtimeHoliday = typeof row[10] === "number" ? row[10] : null;
    const workDays = stringOrNull(row[11]);
    const tripDays = typeof row[12] === "number" ? row[12] : null;
    const absenceDays = typeof row[13] === "number" ? row[13] : null;
    const leaveDays = typeof row[14] === "number" ? row[14] : null;
    // Add Pay columns (16: Normal, 17: Overtime, 18: Allowance)
    const addPayNormal = typeof row[16] === "number" ? row[16] : null;
    const addPayOvertime = typeof row[17] === "number" ? row[17] : null;
    const addPayAllowance = typeof row[18] === "number" ? row[18] : null;
    // Leave Pay columns (19: Late/Early, 20: NoPaidLeave)
    const leavePayLateEarly = typeof row[19] === "number" ? row[19] : null;
    const leavePayNoPaid = typeof row[20] === "number" ? row[20] : null;
    // Payroll Deduction (21) and Remark (22)
    const payrollDeduction = typeof row[21] === "number" ? row[21] : null;
    const remark = stringOrNull(row[22]);

    if (!name && !userId) continue;

    parsed.push({
      employeeName: name ?? "",
      date: meta.startDate?.toISOString().slice(0, 10) ?? null,
      timeIn: null,
      timeOut: null,
      totalHours: workHoursActual ?? workHours ?? null,
      issues: [],
      sourceLine: i + 1,
      dept: dept ?? meta.dept ?? null,
      userId: userId ?? meta.userId ?? null,
      template: "attendance-statistic",
      workHours: workHours ?? null,
      workHoursActual: workHoursActual ?? null,
      overtimeHours: overtimeHours ?? null,
      overtimeHoliday: overtimeHoliday ?? null,
      lateCount: lateCount ?? null,
      lateMinutes: lateMinutes ?? null,
      earlyCount: earlyCount ?? null,
      earlyMinutes: earlyMinutes ?? null,
      workDays: workDays ?? null,
      tripDays: tripDays ?? null,
      absenceDays: absenceDays ?? null,
      leaveDays: leaveDays ?? null,
      addPayNormal: addPayNormal ?? null,
      addPayOvertime: addPayOvertime ?? null,
      addPayAllowance: addPayAllowance ?? null,
      leavePayLateEarly: leavePayLateEarly ?? null,
      leavePayNoPaid: leavePayNoPaid ?? null,
      payrollDeduction: payrollDeduction ?? null,
      remark: remark ?? null,
    });
  }

  if (!parsed.length) return null;
  return { format: "excel", rows: parsed, warnings };
}

// Parse shift code template (User ID, Name, Dept, then date columns with shift codes)
function parseShiftCodeTemplateSheet(
  rows: (string | number | Date | undefined)[][],
  headerIndex: number
): ParseResult | null {
  const headerRow = rows[headerIndex];
  const meta = parseSheetMeta(rows);
  const warnings: string[] = [];
  if (!meta.startDate) warnings.push("Missing date range start");

  // Detect column positions from header
  let userIdCol = 0;
  let nameCol = 1;
  let deptCol = 2;
  
  headerRow.forEach((cell, idx) => {
    const str = stringOrNull(cell)?.toLowerCase();
    if (str?.includes("user") && str?.includes("id")) userIdCol = idx;
    if (str === "name") nameCol = idx;
    if (str?.includes("dept") || str?.includes("department")) deptCol = idx;
  });

  // Extract dates from header (columns after Department are day numbers)
  const dateColumns: { day: number; columnIndex: number }[] = [];
  for (let i = Math.max(3, userIdCol, nameCol, deptCol) + 1; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (typeof cell === "number") {
      dateColumns.push({ day: cell, columnIndex: i });
    } else {
      const str = stringOrNull(cell);
      if (str && /^\d{1,2}$/.test(str)) {
        dateColumns.push({ day: Number(str), columnIndex: i });
      }
    }
  }

  if (dateColumns.length === 0) return null;

  const parsed: ParsedTimesheetRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.some((cell) => stringOrNull(cell))) continue;

    const userId = stringOrNull(row[userIdCol]);
    const name = stringOrNull(row[nameCol]);
    const dept = stringOrNull(row[deptCol]);

    // Skip rows without a real name/user
    if (!name && !userId) continue;
    if ((name === "0" || name === "-" || name === "") && !userId) continue;

    // Create one row per date column
    for (const { day, columnIndex } of dateColumns) {
      const shiftCode = stringOrNull(row[columnIndex]);
      const date = formatDateFromDay(meta.startDate, day);

      const issues: string[] = [];
      if (!date) issues.push("Missing or invalid date");
      if (!name) issues.push("Missing employee name");
      if (!shiftCode) issues.push("Missing shift code");

      parsed.push({
        employeeName: name ?? "",
        date,
        timeIn: null,
        timeOut: null,
        totalHours: null,
        issues,
        sourceLine: i + 1,
        weekday: null,
        dept: dept ?? meta.dept ?? null,
        userId: userId ?? meta.userId ?? null,
        template: "shift-code-table",
        raw: [shiftCode ?? ""],
      });
    }
  }

  if (!parsed.length) return null;
  return { format: "excel", rows: parsed, warnings };
}

function findAttendanceBlocks(rows: (string | number | Date | undefined)[][]) {
  const blocks: { headerRow: number; headerCol: number }[] = [];
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    const joined = row.map(stringOrNull).filter(Boolean).join(" ").toLowerCase();

    for (let c = 0; c < row.length; c += 1) {
      const cell = stringOrNull(row[c]);
      if (!cell) continue;
      const lower = cell.toLowerCase();

      if (lower.includes("date") && joined.includes("before") && joined.includes("noon")) {
        // widen lookahead to capture merged header spans
        let hasBeforeNoon = false;
        for (let k = 1; k <= 12; k += 1) {
          const look = stringOrNull(row[c + k])?.toLowerCase();
          if (look && look.includes("before") && look.includes("noon")) {
            hasBeforeNoon = true;
            break;
          }
        }
        if (hasBeforeNoon || joined.includes("before noon")) {
          blocks.push({ headerRow: r, headerCol: c });
        }
      }
    }
  }
  return blocks;
}

function parseAttendanceTemplateSheet(rows: (string | number | Date | undefined)[][]): ParseResult | null {
  const blocks = findAttendanceBlocks(rows);
  if (!blocks.length) return null;

  const parsed: ParsedTimesheetRow[] = [];
  const warnings: string[] = [];

  blocks.forEach((block) => {
    const startRow = block.headerRow + 1;
    const c = block.headerCol;
    const meta = parseSheetMeta(rows, { start: c, end: c + 30 });
    if (!meta.startDate) warnings.push("Missing date range start");
    if (!meta.name) warnings.push("Missing employee name");

    let blankStreak = 0;

    for (let i = startRow; i < rows.length; i += 1) {
      const slice: (string | number | Date | undefined)[] = [];
      for (let j = 0; j < 10; j += 1) {
        const value = stringOrNull(rows[i][c + j]);
        slice.push(value ?? "");
      }

      const hasData = slice.some((cell) => stringOrNull(cell));
      if (!hasData) {
        blankStreak += 1;
        if (blankStreak >= 6) break;
        continue;
      }

      const entry = parseAttendanceSheetRow(slice, i, meta);
      if (entry) {
        parsed.push(entry);
        blankStreak = 0;
      }
    }
  });

  if (!parsed.length) return null;
  return { format: "excel", rows: parsed, warnings };
}

function findHeaderRowAndMapping(rows: (string | number | Date | undefined)[][]) {
  let bestIndex = 0;
  let bestMapping = mapHeaderIndices(rows[0]);
  let bestScore = Object.keys(bestMapping).length;

  const maxScan = Math.min(rows.length, 25);
  for (let i = 0; i < maxScan; i += 1) {
    const mapping = mapHeaderIndices(rows[i]);
    const recognized = Object.keys(mapping).length;
    if (!recognized) continue;

    const requiredPresent = REQUIRED_FIELDS.filter((field) => mapping[field] !== undefined).length;
    const score = recognized * 2 + requiredPresent * 3;

    if (score > bestScore) {
      bestScore = score;
      bestMapping = mapping;
      bestIndex = i;
    }
  }

  return { headerIndex: bestIndex, mapping: bestMapping };
}

function parseGenericMappedSheet(rows: (string | number | Date | undefined)[][]): ParseResult {
  if (rows.length === 0) {
    return { format: "excel", rows: [], warnings: ["Worksheet is empty"] };
  }

  const { headerIndex, mapping } = findHeaderRowAndMapping(rows);
  const dataStart = headerIndex + 1;
  const dataRows = rows.slice(dataStart);
  const warnings: string[] = [];

  const missingRequired = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);
  if (missingRequired.length) {
    warnings.push(`Missing columns: ${missingRequired.join(", ")}`);
  }

  const parsedRows = dataRows.map((row, idx) => buildRow(row, mapping, dataStart + idx + 1));

  return {
    format: "excel",
    rows: parsedRows,
    warnings,
  };
}

function buildRow(
  row: (string | number | Date | undefined)[],
  mapping: Partial<Record<NormalizedField, number>>,
  sourceLine: number
): ParsedTimesheetRow {
  const nameIndex = mapping.employeeName;
  const dateIndex = mapping.date;
  const timeInIndex = mapping.timeIn;
  const timeOutIndex = mapping.timeOut;
  const hoursIndex = mapping.hours;

  const rawName = nameIndex !== undefined ? row[nameIndex] : undefined;
  const rawDate = dateIndex !== undefined ? row[dateIndex] : undefined;
  const rawTimeIn = timeInIndex !== undefined ? row[timeInIndex] : undefined;
  const rawTimeOut = timeOutIndex !== undefined ? row[timeOutIndex] : undefined;
  const rawHours = hoursIndex !== undefined ? row[hoursIndex] : undefined;

  const issues: string[] = [];
  const employeeName = typeof rawName === "string" ? rawName.trim() : String(rawName ?? "").trim();
  if (!employeeName) issues.push("Missing employee name");

  const date = parseDateValue(rawDate);
  if (!date) issues.push("Missing or invalid date");

  const timeInMinutes = parseTimeToMinutes(rawTimeIn);
  const timeOutMinutes = parseTimeToMinutes(rawTimeOut);

  const timeIn = timeInMinutes !== null ? minutesToLabel(timeInMinutes) : null;
  const timeOut = timeOutMinutes !== null ? minutesToLabel(timeOutMinutes) : null;

  let totalHours = parseHoursValue(rawHours);
  if (totalHours === null && timeInMinutes !== null && timeOutMinutes !== null) {
    const durationMinutes = timeOutMinutes >= timeInMinutes
      ? timeOutMinutes - timeInMinutes
      : 24 * 60 - (timeInMinutes - timeOutMinutes);
    totalHours = Math.round((durationMinutes / 60) * 100) / 100;
  }

  if (totalHours === null) issues.push("Missing hours (total or derived)");

  return {
    employeeName,
    date,
    timeIn,
    timeOut,
    totalHours,
    issues,
    sourceLine,
  };
}

export function parseExcelTimesheet(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;

  if (!sheetNames.length) {
    throw new Error("No sheets found in workbook");
  }

  const aggregatedRows: ParsedTimesheetRow[] = [];
  const warnings: string[] = [];

  // Prioritize attendance statistic/payroll sheets first
  const prioritySheet = sheetNames.find((name) =>
    name.toLowerCase().includes("attendance statistic") ||
    name.toLowerCase().includes("payroll")
  );

  const orderedSheets = prioritySheet
    ? [prioritySheet, ...sheetNames.filter((n) => n !== prioritySheet)]
    : sheetNames;

  orderedSheets.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: true,
      defval: "",
    });

    const statParsed = parseAttendanceStatisticTable(rows);
    if (statParsed) {
      aggregatedRows.push(...statParsed.rows.map((r) => ({ ...r, sheetName })));
      warnings.push(...statParsed.warnings.map((w) => `${sheetName}: ${w}`));
      return;
    }

    const attendanceParsed = parseAttendanceTemplateSheet(rows);
    if (attendanceParsed) {
      aggregatedRows.push(...attendanceParsed.rows.map((r) => ({ ...r, sheetName })));
      warnings.push(...attendanceParsed.warnings.map((w) => `${sheetName}: ${w}`));
      return;
    }

    // Shift setting table
    const shiftHeaderIndex = rows.findIndex((row) => {
      const text = row.map((cell) => stringOrNull(cell)?.toLowerCase() ?? "").join(" ");
      return text.includes("user id") && text.includes("name");
    });
    if (shiftHeaderIndex !== -1) {
    const shiftParsed = parseShiftCodeTemplateSheet(rows, shiftHeaderIndex);
    if (shiftParsed) {
      aggregatedRows.push(...shiftParsed.rows.map((r) => ({ ...r, sheetName })));
      warnings.push(...shiftParsed.warnings.map((w) => `${sheetName}: ${w}`));
      return;
    }
    }

    const generic = parseGenericMappedSheet(rows);
    aggregatedRows.push(...generic.rows.map((r) => ({ ...r, sheetName })));
    warnings.push(...generic.warnings.map((w) => `${sheetName}: ${w}`));
  });

  return {
    format: "excel",
    rows: aggregatedRows,
    warnings,
  };
}

// CSV uses the same parser; sheet_to_json handles csv buffers via XLSX.read.
export function parseCsvTimesheet(buffer: Buffer): ParseResult {
  const result = parseExcelTimesheet(buffer);
  return { ...result, format: "excel", rows: result.rows.map((r) => ({ ...r, sheetName: r.sheetName ?? "CSV" })) };
}

type Delimiter = "tab" | "pipe" | "comma" | "space";

function splitWithDelimiter(line: string, delimiter: Delimiter) {
  switch (delimiter) {
    case "tab":
      return line.split("\t");
    case "pipe":
      return line.split("|");
    case "comma":
      return line.split(",");
    case "space":
      return line.split(/\s{2,}/);
    default:
      return [line];
  }
}

function detectDelimiter(line: string): { parts: string[]; delimiter: Delimiter } {
  const candidates: { parts: string[]; delimiter: Delimiter }[] = [
    { delimiter: "tab", parts: splitWithDelimiter(line, "tab") },
    { delimiter: "pipe", parts: splitWithDelimiter(line, "pipe") },
    { delimiter: "comma", parts: splitWithDelimiter(line, "comma") },
    { delimiter: "space", parts: splitWithDelimiter(line, "space") },
  ];

  const ranked = candidates
    .filter((candidate) => candidate.parts.length > 1)
    .sort((a, b) => b.parts.length - a.parts.length);

  return ranked[0] ?? { delimiter: "space", parts: [line] };
}

async function extractPdfLines(buffer: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const text = textResult?.text ?? "";
    return text
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);
  } finally {
    await parser.destroy();
  }
}

export async function parsePdfTimesheet(buffer: Buffer): Promise<ParseResult> {
  const lines = await extractPdfLines(buffer);
  if (!lines.length) {
    return { format: "pdf", rows: [], warnings: ["PDF contains no text"] };
  }

  const templateResult = parseAttendanceTemplatePdf(lines);
  if (templateResult) {
    return templateResult;
  }

  let headerIndex = -1;
  let delimiter: Delimiter = "space";
  let mapping: Partial<Record<NormalizedField, number>> = {};
  let headerParts: string[] = [];

  lines.forEach((line: string, idx: number) => {
    const detected = detectDelimiter(line);
    const normalizedParts = detected.parts.map((part) => part.trim());
    const candidate = mapHeaderIndices(normalizedParts);
    const recognized = Object.keys(candidate).length;
    if (recognized >= 2 && recognized > Object.keys(mapping).length) {
      mapping = candidate;
      headerIndex = idx;
      delimiter = detected.delimiter;
      headerParts = normalizedParts;
    }
  });

  if (headerIndex === -1) {
    return {
      format: "pdf",
      rows: [],
      warnings: ["Could not find a header row with recognizable columns"],
    };
  }

  const warnings: string[] = [];
  const missingRequired = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);
  if (missingRequired.length) {
    warnings.push(`Missing columns: ${missingRequired.join(", ")}`);
  }

  const parsedRows: ParsedTimesheetRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = splitWithDelimiter(line, delimiter).map((part) => part.trim());

    if (parts.length < 2) continue;
    const row: (string | number | Date | undefined)[] = headerParts.map((_, idx) => parts[idx]);
    const parsed = buildRow(row, mapping, i + 1);
    parsedRows.push(parsed);
  }

  return {
    format: "pdf",
    rows: parsedRows.map((r) => ({ ...r, sheetName: r.sheetName ?? "PDF" })),
    warnings,
  };
}
