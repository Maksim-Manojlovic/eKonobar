import { PrismaClient } from "@prisma/client";

// Runs once before all integration tests in the project.
// CI applies migrations via `npx prisma migrate deploy` before this runs.
// Locally: start `docker compose up -d` and run `npm run db:push` first.
export async function setup() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "[integration] DATABASE_URL not set.\n" +
      "Start Docker Compose and apply migrations before running integration tests:\n" +
      "  docker compose up -d\n" +
      "  npm run db:push",
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[integration] Cannot connect to PostgreSQL at ${url}.\n` +
      `Run: docker compose up -d\n` +
      `Original error: ${msg}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  // Per-test cleanup is handled by resetDb() in each test file's beforeEach.
  // Worker connection pools are closed automatically when Vitest exits.
}
