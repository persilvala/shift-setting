import type { AttendanceRow } from "./excelParser";
import type { AttendanceStatus } from "./types";

export type AttendanceSummary = {
  employeeName: string;
  dept?: string;
  userId?: string;
  presentDates: string;
  attendanceDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  hours: number;
};

const DEFAULT_SHIFT_START = 8 * 60;
const DEFAULT_SHIFT_END = 17 * 60;
const DEFAULT_BREAK = 60;

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

function getAttendanceStatus(status: string | undefined, hasWork: boolean): AttendanceStatus {
  if (!status) return hasWork ? "full_day" : "absent";
  const lower = status.toLowerCase();
  if (lower.includes("absent")) return "absent";
  if (lower.includes("half") || lower.includes("partial")) return "half_day";
  return hasWork ? "full_day" : "absent";
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
        attendanceDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        hours: 0,
        dates: new Set<string>(),
      });
    }

    const record = byEmployee.get(key)!;
    const date = row.date;
    const beforeIn = timeToMinutes(row.beforeNoonIn);
    const afterIn = timeToMinutes(row.afterNoonIn);
    const afterOut = timeToMinutes(row.afterNoonOut);

    const hasWork = beforeIn !== null || afterIn !== null || afterOut !== null;
    const attendanceStatus = getAttendanceStatus(row.status, hasWork);

    if (attendanceStatus === "absent" && !hasWork) {
      record.absentDays += 1;
    } else if (attendanceStatus === "half_day") {
      record.halfDays += 1;
    } else if (attendanceStatus === "full_day" || hasWork) {
      record.attendanceDays += 1;
      if (date) record.dates.add(date);
    }

    const lowerStatus = (row.status || "").toLowerCase();
    if (lowerStatus.includes("leave")) {
      record.leaveDays += 1;
    }

    if (hasWork) {
      const start = beforeIn ?? afterIn ?? DEFAULT_SHIFT_START;
      const end = afterOut ?? DEFAULT_SHIFT_END;
      const workMinutes = Math.max(0, (end - start) - DEFAULT_BREAK);
      record.hours += minutesToHours(workMinutes);
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
      attendanceDays: entry.attendanceDays,
      halfDays: entry.halfDays,
      absentDays: entry.absentDays,
      leaveDays: entry.leaveDays,
      hours: Math.round(entry.hours * 100) / 100,
    };
  });
}
