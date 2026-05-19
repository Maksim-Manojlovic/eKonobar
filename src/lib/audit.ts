import { dbRaw } from "@/lib/db";

export function logAudit(
  actorId:    string,
  action:     string,
  targetId:   string,
  targetType: string,
  meta?:      Record<string, unknown>,
): void {
  dbRaw.auditLog.create({
    data: { actorId, action, targetId, targetType, meta: meta ?? undefined },
  }).catch(console.error);
}
