import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool as never);
const prisma = new PrismaClient({ adapter });

async function truncateAll() {
  console.log("Truncating all tables...");

  await prisma.$transaction([
    prisma.payrollEntry.deleteMany(),
    prisma.payroll.deleteMany(),
    prisma.timesheetRow.deleteMany(),
    prisma.timesheet.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.admin.deleteMany(),
  ]);

  console.log("All tables truncated successfully!");
}

truncateAll()
  .catch((e) => {
    console.error("Error truncating tables:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
