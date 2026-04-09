/*
  Warnings:

  - You are about to drop the column `overtimeRate` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `basePay` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `employeeName` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `employeeUserId` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `manualAddition` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `manualDeduction` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `netPay` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `overtimeHours` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `overtimePay` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `totalAdditions` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `totalDeductions` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `workDays` on the `PayrollEntry` table. All the data in the column will be lost.
  - You are about to drop the column `workHours` on the `PayrollEntry` table. All the data in the column will be lost.
  - Added the required column `employeeId` to the `PayrollEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payroll" DROP COLUMN "overtimeRate",
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timesheetId" TEXT;

-- AlterTable
ALTER TABLE "PayrollEntry" DROP COLUMN "basePay",
DROP COLUMN "department",
DROP COLUMN "employeeName",
DROP COLUMN "employeeUserId",
DROP COLUMN "manualAddition",
DROP COLUMN "manualDeduction",
DROP COLUMN "netPay",
DROP COLUMN "overtimeHours",
DROP COLUMN "overtimePay",
DROP COLUMN "totalAdditions",
DROP COLUMN "totalDeductions",
DROP COLUMN "workDays",
DROP COLUMN "workHours",
ADD COLUMN     "addedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "employeeId" TEXT NOT NULL,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subtractedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "timesheetRowId" TEXT;

-- AlterTable
ALTER TABLE "TimesheetRow" ADD COLUMN     "attendanceStatus" TEXT NOT NULL DEFAULT 'full_day',
ADD COLUMN     "employeeId" TEXT;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "basePayPerDay" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeName_key" ON "Employee"("employeeName");

-- CreateIndex
CREATE INDEX "Employee_employeeName_idx" ON "Employee"("employeeName");

-- CreateIndex
CREATE INDEX "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetRow_employeeId_idx" ON "TimesheetRow"("employeeId");

-- AddForeignKey
ALTER TABLE "TimesheetRow" ADD CONSTRAINT "TimesheetRow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_timesheetRowId_fkey" FOREIGN KEY ("timesheetRowId") REFERENCES "TimesheetRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
