import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = "persilvala";
  const password = "Asceoft@2026";

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { username },
    update: {
      passwordHash,
      mustChangePassword: false,
    },
    create: {
      username,
      passwordHash,
      mustChangePassword: false,
    },
  });

  console.log(`Admin seeded: username=${username}, password=${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
