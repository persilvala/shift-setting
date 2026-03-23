-- Add attendanceDays, halfDays, absentDays to PayrollEntry
ALTER TABLE "PayrollEntry" ADD COLUMN "attendanceDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "halfDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "absentDays" INTEGER NOT NULL DEFAULT 0;
