-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "employeeName" TEXT NOT NULL,
    "basePayPerDay" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT,
    "format" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entrySource" TEXT DEFAULT 'upload',

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetRow" (
    "id" SERIAL NOT NULL,
    "timesheetId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "employeeName" TEXT NOT NULL,
    "userId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
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
    "attendanceStatus" TEXT NOT NULL DEFAULT 'full_day',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" SERIAL NOT NULL,
    "timesheetId" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "basePayPerDay" DOUBLE PRECISION NOT NULL,
    "totalNetPay" DOUBLE PRECISION NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" SERIAL NOT NULL,
    "payrollId" INTEGER NOT NULL,
    "timesheetRowId" INTEGER,
    "employeeId" INTEGER NOT NULL,
    "attendanceDays" INTEGER NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "basePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtractedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeName_key" ON "Employee"("employeeName");

-- CreateIndex
CREATE INDEX "Employee_employeeName_idx" ON "Employee"("employeeName");

-- CreateIndex
CREATE INDEX "Timesheet_uploadedAt_idx" ON "Timesheet"("uploadedAt");

-- CreateIndex
CREATE INDEX "TimesheetRow_timesheetId_idx" ON "TimesheetRow"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetRow_employeeName_idx" ON "TimesheetRow"("employeeName");

-- CreateIndex
CREATE INDEX "TimesheetRow_employeeId_idx" ON "TimesheetRow"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetRow_date_idx" ON "TimesheetRow"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetRow_employeeId_date_key" ON "TimesheetRow"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Payroll_generatedAt_idx" ON "Payroll"("generatedAt");

-- CreateIndex
CREATE INDEX "PayrollEntry_payrollId_idx" ON "PayrollEntry"("payrollId");

-- CreateIndex
CREATE INDEX "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "TimesheetRow" ADD CONSTRAINT "TimesheetRow_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetRow" ADD CONSTRAINT "TimesheetRow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_timesheetRowId_fkey" FOREIGN KEY ("timesheetRowId") REFERENCES "TimesheetRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
