// Shared types for the Shift Setting application

export type AttendanceStatus = "absent" | "full_day" | "half_day";

export type ParsedTimesheetRow = {
  id?: string;
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
  isSoftDeleted?: boolean;
  employeeId?: string;
  attendanceStatus?: AttendanceStatus;
  beforeNoonIn?: string | null;
  beforeNoonOut?: string | null;
  afterNoonIn?: string | null;
  afterNoonOut?: string | null;
  overtimeIn?: string | null;
  overtimeOut?: string | null;
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
  addPayNormal?: number | null;
  addPayOvertime?: number | null;
  addPayAllowance?: number | null;
  leavePayLateEarly?: number | null;
  leavePayNoPaid?: number | null;
  payrollDeduction?: number | null;
  remark?: string | null;
};

export type Employee = {
  id: string;
  employeeName: string;
  basePayPerDay: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollEntry = {
  id: string;
  payrollId: string;
  timesheetRowId: string | null;
  employeeId: string;
  addedValue: number;
  subtractedValue: number;
  isEdited: boolean;
  createdAt: Date;
};

export type PayrollEntryDisplay = {
  id: string;
  payrollId: string;
  employeeId: string;
  employeeName: string;
  timesheetRowId: string | null;
  attendanceStatus: AttendanceStatus;
  addedValue: number;
  subtractedValue: number;
  isEdited: boolean;
  workDays: number;
  halfDays: number;
  absentDays: number;
  basePay: number;
  netPay: number;
  startDate: string;
  endDate: string;
};

export type TimesheetMeta = {
  format?: "excel" | "pdf";
  totalRows?: number;
  uploadedAt?: string;
  timesheetId?: string;
  startDate?: string | null;
  endDate?: string | null;
};

export type DashboardRow = {
  employeeName: string;
  userId: string | null;
  date: string;
  weekday: string | null;
  dept: string | null;
  totalHours: number | null;
  workHours: number | null;
  workHoursActual: number | null;
  overtimeHours: number | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  absenceDays: number | null;
  attendanceStatus: AttendanceStatus;
  leaveDays: number | null;
};

export type FilterState = {
  employee: string;
  dept: string;
  startDate: string;
  endDate: string;
};

export type Adjustment = {
  addition: number;
  deduction: number;
};

export type SavedPayroll = {
  id: string;
  timesheetId: string | null;
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  totalNetPay: number;
  isEdited: boolean;
  generatedAt: string;
  _count: { entries: number };
};

export type TimesheetHistoryItem = {
  id: string;
  startDate: string;
  endDate: string;
  uploadedAt: string;
  rowCount: number;
  rows: ParsedTimesheetRow[];
};

export type HistoryPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
