import type { AttendanceRow } from "./excelParser";

export type AttendanceSummary = {
  employeeName: string;
  dept?: string;
  userId?: string;
  presentDates: string;
  present: number;
  leave: number;
  absent: number;
  hours: number;
  overtimeHours: number;
  lateMinutes: number;
  underMinutes: number;
};

const DEFAULT_SHIFT_START = 8 * 60; // 08:00
const DEFAULT_SHIFT_END = 17 * 60; // 17:00
const DEFAULT_BREAK = 60; // minutes

function timeToMinutes(value?: string) {
  if (!value) return null;
  const clean = value.trim().toUpperCase();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const ap = ampmMatch[3];
    if (ap) {
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
    }
    return h * 60 + m;
  }
  const num = Number(clean);
  if (!Number.isNaN(num) && num >= 0 && num <= 24) {
    return Math.round(num * 60);
  }
  return null;
}

function minutesToHours(min: number) {
  return Math.round((min / 60) * 100) / 100;
}

export function summarizeAttendance(rows: AttendanceRow[]): AttendanceSummary[] {
  const byEmployee = new Map<string, AttendanceSummary & { dates: Set<string> }>();

  rows.forEach((row) => {
    const name = row.employeeName || "Unnamed";
    const key = `${row.userId ?? ""}|${name}`;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeName: name,
        dept: row.dept,
        userId: row.userId,
        presentDates: "",
        present: 0,
        leave: 0,
        absent: 0,
        hours: 0,
        overtimeHours: 0,
        lateMinutes: 0,
        underMinutes: 0,
        dates: new Set<string>(),
      });
    }

    const record = byEmployee.get(key)!;
    const date = row.date;
    const beforeIn = timeToMinutes(row.beforeNoonIn);
    const afterOut = timeToMinutes(row.afterNoonOut);
    const afterIn = timeToMinutes(row.afterNoonIn);
    const beforeOut = timeToMinutes(row.beforeNoonOut);
    const otIn = timeToMinutes(row.overtimeIn);
    const otOut = timeToMinutes(row.overtimeOut);

    const hasWork = beforeIn !== null || afterIn !== null || afterOut !== null;
    const status = (row.status || "").toLowerCase();

    if (status.includes("leave")) {
      record.leave += 1;
    } else if (status.includes("absent")) {
      record.absent += 1;
    } else if (hasWork) {
      record.present += 1;
      if (date) record.dates.add(date);
    } else if (date) {
      record.absent += 1;
    }

    if (hasWork) {
      const start = beforeIn ?? afterIn ?? DEFAULT_SHIFT_START;
      const end = afterOut ?? beforeOut ?? DEFAULT_SHIFT_END;
      const workMinutes = Math.max(0, (end - start) - DEFAULT_BREAK);
      record.hours += minutesToHours(workMinutes);

      if (otIn !== null && otOut !== null && otOut > otIn) {
        record.overtimeHours += minutesToHours(otOut - otIn);
      }

      if (beforeIn !== null && beforeIn > DEFAULT_SHIFT_START) {
        record.lateMinutes += beforeIn - DEFAULT_SHIFT_START;
      }

      if (afterOut !== null && afterOut < DEFAULT_SHIFT_END) {
        record.underMinutes += DEFAULT_SHIFT_END - afterOut;
      }
    }
  });

  return Array.from(byEmployee.values()).map((entry) => {
    const sortedDates = Array.from(entry.dates).sort();
    const presentDates = sortedDates.length
      ? `${sortedDates[0]}${sortedDates.length > 1 ? ` – ${sortedDates[sortedDates.length - 1]}` : ""}`
      : "—";
    return {
      employeeName: entry.employeeName,
      dept: entry.dept,
      userId: entry.userId,
      presentDates,
      present: entry.present,
      leave: entry.leave,
      absent: entry.absent,
      hours: Math.round(entry.hours * 100) / 100,
      overtimeHours: Math.round(entry.overtimeHours * 100) / 100,
      lateMinutes: entry.lateMinutes,
      underMinutes: entry.underMinutes,
    };
  });
}
