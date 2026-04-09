-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetRow" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "basePayPerDay" DOUBLE PRECISION NOT NULL,
    "overtimeRate" DOUBLE PRECISION NOT NULL,
    "totalNetPay" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeUserId" TEXT,
    "department" TEXT,
    "workDays" INTEGER NOT NULL,
    "workHours" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL,
    "basePay" DOUBLE PRECISION NOT NULL,
    "overtimePay" DOUBLE PRECISION NOT NULL,
    "totalAdditions" DOUBLE PRECISION NOT NULL,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "manualAddition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Timesheet_uploadedAt_idx" ON "Timesheet"("uploadedAt");

-- CreateIndex
CREATE INDEX "TimesheetRow_timesheetId_idx" ON "TimesheetRow"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetRow_employeeName_idx" ON "TimesheetRow"("employeeName");

-- CreateIndex
CREATE INDEX "TimesheetRow_date_idx" ON "TimesheetRow"("date");

-- CreateIndex
CREATE INDEX "Payroll_generatedAt_idx" ON "Payroll"("generatedAt");

-- CreateIndex
CREATE INDEX "PayrollEntry_payrollId_idx" ON "PayrollEntry"("payrollId");

-- AddForeignKey
ALTER TABLE "TimesheetRow" ADD CONSTRAINT "TimesheetRow_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
