import { Prisma } from "@prisma/client";
import { dbRaw } from "@/lib/db";
import logger from "@/lib/logger";

export function logAudit(
  actorId:    string,
  action:     string,
  targetId:   string,
  targetType: string,
  meta?:      Prisma.InputJsonValue,
): void {
  dbRaw.auditLog.create({
    data: { actorId, action, targetId, targetType, meta: meta ?? Prisma.DbNull },
  }).catch((err) => logger.error({ err, actorId, action, targetId }, "audit write failed"));
}
