import { prisma } from '../db/prisma.js';

interface AuditInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: unknown;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload === undefined ? null : JSON.stringify(input.payload),
      },
    });
  } catch (err) {
    console.error('[audit] write failed', err);
  }
}
