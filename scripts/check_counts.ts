import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool as never);
const prisma = new PrismaClient({ adapter });

async function main() {
  const [adminCount, employeeCount, timesheetCount] = await Promise.all([
    prisma.admin.count(),
    prisma.employee.count(),
    prisma.timesheet.count(),
  ]);
  console.log('Admin:', adminCount);
  console.log('Employee:', employeeCount);
  console.log('Timesheet:', timesheetCount);
}

main()
  .finally(() => prisma.$disconnect())
  .catch(console.error);
