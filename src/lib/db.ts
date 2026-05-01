import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { _prisma: PrismaClient };

const prismaRaw = globalForPrisma._prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma._prisma = prismaRaw;
}

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
    },
  },
});
