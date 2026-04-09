-- ============================================
-- Shift Setting Database - Quick Start Queries
-- ============================================

-- 1. View Recent Timesheets
SELECT * FROM "Timesheet" ORDER BY "uploadedAt" DESC LIMIT 10;

-- 2. View Timesheet Rows by Employee
SELECT 
  "employeeName",
  "date",
  "workHours",
  "overtimeHours",
  "lateMinutes"
FROM "TimesheetRow"
ORDER BY "date" DESC
LIMIT 50;

-- 3. View All Payroll Records
SELECT * FROM "Payroll" ORDER BY "generatedAt" DESC;

-- 4. View Payroll Entries with Details
SELECT 
  "employeeName",
  "workDays",
  "workHours",
  "overtimeHours",
  "basePay",
  "overtimePay",
  "netPay"
FROM "PayrollEntry"
ORDER BY "createdAt" DESC
LIMIT 50;

-- 5. Count Records per Table
SELECT 
  'Timesheet' as table_name, COUNT(*) as count FROM "Timesheet"
UNION ALL
SELECT 'TimesheetRow', COUNT(*) FROM "TimesheetRow"
UNION ALL
SELECT 'Payroll', COUNT(*) FROM "Payroll"
UNION ALL
SELECT 'PayrollEntry', COUNT(*) FROM "PayrollEntry";

-- 6. Timesheet Rows for a Specific Employee
-- Replace 'Employee Name' with actual name
-- SELECT * FROM "TimesheetRow" WHERE "employeeName" = 'Employee Name' ORDER BY "date" DESC;

-- 7. Total Work Hours per Employee (Current Period)
-- SELECT 
--   "employeeName",
--   SUM("workHours") as totalWorkHours,
--   SUM("overtimeHours") as totalOvertimeHours,
--   COUNT(*) as totalDays
-- FROM "TimesheetRow"
-- GROUP BY "employeeName"
-- ORDER BY totalWorkHours DESC;

-- 8. Payroll Summary by Employee
-- SELECT 
--   "employeeName",
--   SUM("basePay") as totalBasePay,
--   SUM("overtimePay") as totalOvertimePay,
--   SUM("netPay") as totalNetPay
-- FROM "PayrollEntry"
-- GROUP BY "employeeName"
-- ORDER BY totalNetPay DESC;
