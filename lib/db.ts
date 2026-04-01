import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  try {
    const adapter = new PrismaNeon({
      connectionString: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
    });
    return new PrismaClient({ adapter });
  } catch (error) {
    console.warn("Failed to initialize Prisma adapter:", error);
    return new PrismaClient(); // fallback
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
