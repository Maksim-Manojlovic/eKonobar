import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { _prisma: PrismaClient };

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL!;
  if (url.includes("connection_limit")) return url;
  const sep = url.includes("?") ? "&" : "?";
  const limit = process.env.DATABASE_POOL_SIZE ?? "3";
  return `${url}${sep}connection_limit=${limit}&pool_timeout=10`;
}

const prismaRaw =
  globalForPrisma._prisma ??
  new PrismaClient({ datasources: { db: { url: buildDatabaseUrl() } } });

// Cache on globalThis in all envs — module cache persists across warm serverless
// invocations and across HMR cycles in dev, avoiding connection exhaustion in both.
globalForPrisma._prisma = prismaRaw;

// Direktan pristup bez filtera — za admin operacije i sync-scores cron jobove
export const dbRaw = prismaRaw;

// Klijent sa soft-delete filterom: automatski isključuje User, Venue, JobPost
// zapise gde je deletedAt != null
export const db = prismaRaw.$extends({
  query: {
    user: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findMany({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findFirst({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findUnique({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
    venue: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findMany({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findFirst({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findUnique({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
    jobPost: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findMany({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findFirst({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async findUnique({ args, query }: any) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
  },
});
