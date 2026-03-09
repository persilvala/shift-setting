import * as XLSX from "xlsx";

export type AttendanceRow = {
  employeeName: string;
  dept?: string;
  userId?: string;
  date?: string;
  beforeNoonIn?: string;
  beforeNoonOut?: string;
  afterNoonIn?: string;
  afterNoonOut?: string;
  overtimeIn?: string;
  overtimeOut?: string;
  status?: string;
};

const HEADER_ALIASES: Record<string, string[]> = {
  employee: ["employee", "employee name", "name", "staff", "full name"],
  dept: ["dept", "department", "team"],
  userId: ["user id", "userid", "id", "emp id", "employee id"],
  date: ["date", "work date", "shift date"],
  beforeNoonIn: ["before noon in", "am in", "time in", "clock in", "in"],
  beforeNoonOut: ["before noon out", "am out", "break out"],
  afterNoonIn: ["after noon in", "pm in", "break in"],
  afterNoonOut: ["after noon out", "pm out", "time out", "clock out", "out"],
  overtimeIn: ["overtime in", "ot in"],
  overtimeOut: ["overtime out", "ot out"],
  status: ["status", "attendance", "remark", "remarks", "comment"],
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function findHeader(sheetRows: (string | number | Date | undefined)[][]) {
  const maxScan = Math.min(sheetRows.length, 30);
  let best = { rowIndex: -1, score: 0, mapping: {} as Record<string, number> };

  for (let i = 0; i < maxScan; i += 1) {
    const row = sheetRows[i];
    const mapping: Record<string, number> = {};
    row.map(normalize).forEach((cell, idx) => {
      Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
        if (mapping[key] !== undefined) return;
        if (aliases.some((alias) => cell === normalize(alias) || cell.includes(normalize(alias)))) {
          mapping[key] = idx;
        }
      });
    });
    const score = Object.keys(HEADER_ALIASES).reduce((sum, key) => (mapping[key] !== undefined ? sum + 1 : sum), 0);
    if (score > best.score) {
      best = { rowIndex: i, score, mapping };
    }
  }

  return best;
}

function parseDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const jsDate = new Date(Date.UTC(parsed.y, (parsed.m ?? 1) - 1, parsed.d ?? 1));
      if (!Number.isNaN(jsDate.getTime())) return jsDate.toISOString().slice(0, 10);
    }
  }
  if (typeof value === "string") {
    const d = new Date(value.trim());
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return undefined;
}

function toString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

export function parseExcelFile(buffer: ArrayBuffer): AttendanceRow[] {
  const workbook = XLSX.read(buffer, { type: "array", raw: true });
  const rows: AttendanceRow[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const matrix = XLSX.utils.sheet_to_json<(string | number | Date | undefined)[]>(sheet, { header: 1, defval: "" });
    if (!matrix.length) return;

    const { rowIndex, mapping, score } = findHeader(matrix);
    if (score < 3 || rowIndex < 0) return;

    const dataRows = matrix.slice(rowIndex + 1).filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""));
    dataRows.forEach((row) => {
      const employeeName = toString(row[mapping.employee ?? -1]);
      const date = parseDate(row[mapping.date ?? -1]);
      const beforeNoonIn = toString(row[mapping.beforeNoonIn ?? -1]);
      const beforeNoonOut = toString(row[mapping.beforeNoonOut ?? -1]);
      const afterNoonIn = toString(row[mapping.afterNoonIn ?? -1]);
      const afterNoonOut = toString(row[mapping.afterNoonOut ?? -1]);
      const overtimeIn = toString(row[mapping.overtimeIn ?? -1]);
      const overtimeOut = toString(row[mapping.overtimeOut ?? -1]);
      const dept = toString(row[mapping.dept ?? -1]);
      const userId = toString(row[mapping.userId ?? -1]);
      const status = toString(row[mapping.status ?? -1]);

      if (!employeeName && !date && !beforeNoonIn && !afterNoonOut) return;

      rows.push({
        employeeName: employeeName ?? "",
        dept: dept ?? undefined,
        userId: userId ?? undefined,
        date,
        beforeNoonIn,
        beforeNoonOut,
        afterNoonIn,
        afterNoonOut,
        overtimeIn,
        overtimeOut,
        status,
      });
    });
  });

  return rows;
}
