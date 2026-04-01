-- Create Admin table
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" SERIAL PRIMARY KEY,
    "username" TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP
);

-- Create Employee table
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" SERIAL PRIMARY KEY,
    "employeeName" TEXT UNIQUE NOT NULL,
    "basePayPerDay" DOUBLE PRECISION,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP
);

-- Create Timesheet table
CREATE TABLE IF NOT EXISTS "Timesheet" (
    "id" SERIAL PRIMARY KEY,
    "fileName" TEXT,
    "format" TEXT NOT NULL,
    "startDate" TIMESTAMP NOT NULL,
    "endDate" TIMESTAMP NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "entrySource" TEXT DEFAULT 'upload'
);

-- Create TimesheetRow table
CREATE TABLE IF NOT EXISTS "TimesheetRow" (
    "id" SERIAL PRIMARY KEY,
    "timesheetId" INTEGER REFERENCES "Timesheet"("id") ON DELETE CASCADE,
    "employeeId" INTEGER REFERENCES "Employee"("id") ON DELETE SET NULL,
    "employeeName" TEXT NOT NULL,
    "userId" TEXT,
    "date" TIMESTAMP NOT NULL,
    "weekday" TEXT,
    "dept" TEXT,
    "beforeNoonIn" TEXT,
    "beforeNoonOut" TEXT,
    "afterNoonIn" TEXT,
    "afterNoonOut" TEXT,
    "overtimeIn" TEXT,
    "overtimeOut" TEXT,
    "totalHours" DOUBLE PRECISION,
    "lateMinutes" INTEGER,
    "earlyMinutes" INTEGER,
    "workHours" DOUBLE PRECISION,
    "workHoursActual" DOUBLE PRECISION,
    "overtimeHours" DOUBLE PRECISION,
    "workDays" TEXT,
    "tripDays" DOUBLE PRECISION,
    "absenceDays" DOUBLE PRECISION,
    "leaveDays" DOUBLE PRECISION,
    "addPayNormal" DOUBLE PRECISION,
    "addPayOvertime" DOUBLE PRECISION,
    "addPayAllowance" DOUBLE PRECISION,
    "payrollDeduction" DOUBLE PRECISION,
    "shiftCode" TEXT,
    "remark" TEXT,
    "attendanceStatus" TEXT DEFAULT 'full_day',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Payroll table
CREATE TABLE IF NOT EXISTS "Payroll" (
    "id" SERIAL PRIMARY KEY,
    "timesheetId" INTEGER REFERENCES "Timesheet"("id") ON DELETE SET NULL,
    "startDate" TIMESTAMP NOT NULL,
    "endDate" TIMESTAMP NOT NULL,
    "basePayPerDay" DOUBLE PRECISION NOT NULL,
    "totalNetPay" DOUBLE PRECISION NOT NULL,
    "isEdited" BOOLEAN DEFAULT false,
    "generatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create PayrollEntry table
CREATE TABLE IF NOT EXISTS "PayrollEntry" (
    "id" SERIAL PRIMARY KEY,
    "payrollId" INTEGER REFERENCES "Payroll"("id") ON DELETE CASCADE,
    "timesheetRowId" INTEGER REFERENCES "TimesheetRow"("id") ON DELETE SET NULL,
    "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
    "attendanceDays" INTEGER DEFAULT 0,
    "halfDays" INTEGER DEFAULT 0,
    "absentDays" INTEGER DEFAULT 0,
    "basePay" DOUBLE PRECISION DEFAULT 0,
    "addedValue" DOUBLE PRECISION DEFAULT 0,
    "subtractedValue" DOUBLE PRECISION DEFAULT 0,
    "netPay" DOUBLE PRECISION DEFAULT 0,
    "isEdited" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "noteCreatedBy" TEXT,
    "noteCreatedAt" TIMESTAMP,
    "noteEditedBy" TEXT,
    "noteEditedAt" TIMESTAMP
);

-- Create Session table
CREATE TABLE IF NOT EXISTS "Session" (
    "id" SERIAL PRIMARY KEY,
    "sessionToken" TEXT UNIQUE NOT NULL,
    "userId" INTEGER NOT NULL REFERENCES "Admin"("id") ON DELETE CASCADE,
    "expires" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Employee_employeeName_idx" ON "Employee"("employeeName");
CREATE INDEX IF NOT EXISTS "Timesheet_uploadedAt_idx" ON "Timesheet"("uploadedAt");
CREATE INDEX IF NOT EXISTS "TimesheetRow_timesheetId_idx" ON "TimesheetRow"("timesheetId");
CREATE INDEX IF NOT EXISTS "TimesheetRow_employeeName_idx" ON "TimesheetRow"("employeeName");
CREATE INDEX IF NOT EXISTS "TimesheetRow_employeeId_idx" ON "TimesheetRow"("employeeId");
CREATE INDEX IF NOT EXISTS "TimesheetRow_date_idx" ON "TimesheetRow"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "TimesheetRow_employeeId_date_key" ON "TimesheetRow"("employeeId", "date");
CREATE INDEX IF NOT EXISTS "Payroll_generatedAt_idx" ON "Payroll"("generatedAt");
CREATE INDEX IF NOT EXISTS "PayrollEntry_payrollId_idx" ON "PayrollEntry"("payrollId");
CREATE INDEX IF NOT EXISTS "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- Insert admin
INSERT INTO "Admin" (username, "passwordHash", "mustChangePassword", "updatedAt")
VALUES ('admin', '$2b$10$.r9DCukqXT2sCvZ4ix4qX.Z/WJc/WE2C0MavKIeHDXrd2SLAO4jLm', false, CURRENT_TIMESTAMP)
ON CONFLICT ("username") DO NOTHING;
