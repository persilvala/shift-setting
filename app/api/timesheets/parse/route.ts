import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type SummaryRow = {
  name: string;
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  hours: number | null;
  sheetName: string;
};

const DATE_RANGE_REGEX = /(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/;

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isLikelyName(value: string | null | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const stopWords = [
    "before noon",
    "after noon",
    "time card",
    "employee attendance table",
    "in",
    "out",
    "login",
    "logout",
    "time in",
    "time out",
  ];
  if (stopWords.includes(lower)) return false;
  if (/^[-0-9.\s]+$/.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  if (!/[a-z]/i.test(trimmed)) return false;
  return true;
}

function parseTimeToMinutes(value: unknown): number | null {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel time fraction of a day
    if (value >= 0 && value < 1) return Math.round(value * 24 * 60);
    // If someone typed 16.5 meaning hours
    if (value >= 0 && value <= 48) return Math.round(value * 60);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // HH:MM[:SS][.ms] with optional AM/PM
    const match = trimmed.match(
      /^([0-2]?\d):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:\s*([AP]M))?$/i
    );
    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const meridiem = match[4]?.toUpperCase();
      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }

    // 16.5 => 16h30
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && numeric >= 0 && numeric <= 48) {
      return Math.round(numeric * 60);
    }
  }

  return null;
}

function minutesToLabel(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.abs(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDateFromDay(start: Date | null, day: number | null) {
  if (!start || day === null) return null;
  const date = new Date(start);
  date.setDate(start.getDate() + day - 1);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function findDateRange(
  rows: (string | number | Date | undefined)[][],
  headerRow: number,
  headerCol: number
) {
  for (let r = Math.max(0, headerRow - 6); r <= Math.min(rows.length - 1, headerRow + 6); r += 1) {
    const slice = rows[r].slice(headerCol, headerCol + 12);
    const joined = slice.map(stringOrNull).filter(Boolean).join(" ");
    const match = joined.match(DATE_RANGE_REGEX);
    if (match) {
      const start = new Date(match[1]);
      const end = new Date(match[2]);
      return { start, end };
    }
  }
  return { start: null, end: null };
}

function findName(
  rows: (string | number | Date | undefined)[][],
  headerRow: number,
  headerCol: number
) {
  for (let r = headerRow - 1; r >= Math.max(0, headerRow - 6); r -= 1) {
    const slice = rows[r].slice(Math.max(0, headerCol - 2), headerCol + 10);
    for (let c = 0; c < slice.length; c += 1) {
      const val = stringOrNull(slice[c]);
      if (isLikelyName(val)) return val!.trim();
    }
  }
  return null;
}

function parseDayCell(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = stringOrNull(value);
  if (!str) return null;
  const m = str.match(/^(\d{1,2})/);
  if (m) return Number(m[1]);
  return null;
}

function parseTimeRow(cells: unknown[]): { timeIn: string | null; timeOut: string | null; hours: number | null } {
  const minutes = cells
    .map((cell) => parseTimeToMinutes(cell))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  if (!minutes.length) return { timeIn: null, timeOut: null, hours: null };

  const earliest = minutes[0];
  const latest = minutes[minutes.length - 1];
  const duration = latest >= earliest ? latest - earliest : latest + (24 * 60 - earliest);
  const hours = Math.round((duration / 60) * 100) / 100;

  return {
    timeIn: minutesToLabel(earliest),
    timeOut: minutesToLabel(latest),
    hours,
  };
}

function parseTimeCardBlock(
  rows: (string | number | Date | undefined)[][],
  headerRow: number,
  headerCol: number,
  sheetName: string
): SummaryRow[] {
  const { start: startDate } = findDateRange(rows, headerRow, headerCol);
  const name = findName(rows, headerRow, headerCol) ?? "";

  const results: SummaryRow[] = [];
  const dataStart = headerRow + 1;
  let blankStreak = 0;

  for (let r = dataStart; r < rows.length; r += 1) {
    const slice = rows[r].slice(headerCol, headerCol + 12);
    const hasData = slice.some((cell) => stringOrNull(cell));
    if (!hasData) {
      blankStreak += 1;
      if (blankStreak >= 6) break;
      continue;
    }
    blankStreak = 0;

    const day = parseDayCell(slice[0]);
    if (day === null || day < 1 || day > 31) continue;

    // columns: [day, bn in, bn out, an in, an out, ot in, ot out]
    const timeCells = slice.slice(1, 7);
    const parsed = parseTimeRow(timeCells);
    const date = formatDateFromDay(startDate, day);

    results.push({
      name,
      date,
      timeIn: parsed.timeIn,
      timeOut: parsed.timeOut,
      hours: parsed.hours,
      sheetName,
    });
  }

  return results;
}

function findTimeCardBlocks(rows: (string | number | Date | undefined)[][]) {
  const blocks: { headerRow: number; headerCol: number }[] = [];

  rows.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      const val = stringOrNull(cell)?.toLowerCase();
      if (!val) return;

      // Detect via explicit labels
      if (val.includes("before") && val.includes("noon")) {
        blocks.push({ headerRow: rIdx, headerCol: cIdx });
      }

      // Detect via "time card" keyword in same row
      const joined = row.map(stringOrNull).filter(Boolean).join(" ").toLowerCase();
      if (joined.includes("time card")) {
        blocks.push({ headerRow: rIdx, headerCol: cIdx });
      }
    });
  });

  // Deduplicate close blocks (same row, nearby col)
  const uniq: { headerRow: number; headerCol: number }[] = [];
  blocks.forEach((b) => {
    const exists = uniq.some((u) => u.headerRow === b.headerRow && Math.abs(u.headerCol - b.headerCol) <= 2);
    if (!exists) uniq.push(b);
  });

  return uniq;
}

function shouldParseSheet(name: string, rows: (string | number | Date | undefined)[][]) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("time card") || lowerName.includes("employee attendance")) return true;
  return rows.some((row) => row.some((cell) => stringOrNull(cell)?.toLowerCase().includes("time card")));
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): SummaryRow[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  if (!shouldParseSheet(sheetName, rows)) return [];

  const blocks = findTimeCardBlocks(rows);
  const results: SummaryRow[] = [];

  blocks.forEach((block) => {
    results.push(...parseTimeCardBlock(rows, block.headerRow, block.headerCol, sheetName));
  });

  return results;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "File is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const rows: SummaryRow[] = [];

    workbook.SheetNames.forEach((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return;
      rows.push(...parseSheet(name, sheet));
    });

    const merged = rows
      .filter((row) => isLikelyName(row.name))
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return (a.date ?? "").localeCompare(b.date ?? "");
      });

    return NextResponse.json({ ok: true, rows: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
