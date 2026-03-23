-- Add attendanceDays, halfDays, absentDays to PayrollEntry (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PayrollEntry' AND column_name = 'attendanceDays') THEN
        ALTER TABLE "PayrollEntry" ADD COLUMN "attendanceDays" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PayrollEntry' AND column_name = 'halfDays') THEN
        ALTER TABLE "PayrollEntry" ADD COLUMN "halfDays" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PayrollEntry' AND column_name = 'absentDays') THEN
        ALTER TABLE "PayrollEntry" ADD COLUMN "absentDays" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;
