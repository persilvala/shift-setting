// Shared types for the Shift Setting application

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
  // Time card fields
  beforeNoonIn?: string | null;
  beforeNoonOut?: string | null;
  afterNoonIn?: string | null;
  afterNoonOut?: string | null;
  overtimeIn?: string | null;
  overtimeOut?: string | null;
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

export type PayrollEntry = {
  userId: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  workDays: number;
  workHours: number;
  overtimeHours: number;
  basePayPerDay: number;
  basePay: number;
  overtimePay: number;
  additions: Array<{ description: string; amount: number }>;
  deductions: Array<{ description: string; amount: number }>;
  totalAdditions: number;
  totalDeductions: number;
  netPay: number;
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
  startDate: string;
  endDate: string;
  basePayPerDay: number;
  overtimeRate: number;
  totalNetPay: number;
  generatedAt: string;
  _count: { entries: number };
};
