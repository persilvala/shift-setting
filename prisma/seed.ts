import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.admin.findUnique({
    where: { username: "admin" },
  });

  if (existingAdmin) {
    console.log("Admin already exists, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("123", 10);

  await prisma.admin.create({
    data: {
      username: "admin",
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log("Initial admin created: username=admin, password=123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
