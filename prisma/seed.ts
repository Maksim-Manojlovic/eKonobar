import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "Test1234!";

const users = [
  { name: "Test Waiter", email: "waiter@test.com", role: "WAITER" as const },
  { name: "Test Venue", email: "venue@test.com", role: "VENUE_OWNER" as const },
  { name: "Test Admin", email: "admin@test.com", role: "ADMIN" as const },
];

async function main() {
  const hashedPassword = await hash(TEST_PASSWORD, 12);

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        name: user.name,
        email: user.email,
        hashedPassword,
        role: user.role,
      },
    });
    console.log(`✓ ${user.role}: ${user.email}`);
  }

  console.log(`\nPassword for all accounts: ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
