import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const querySchema = z.object({
  userId: z.string().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

// GET /api/audit-log
router.get('/', async (req, res, next) => {
  try {
    const f = querySchema.parse(req.query);
    const where: Prisma.AuditLogWhereInput = {};
    if (f.userId) where.userId = f.userId;
    if (f.entityType) where.entityType = { contains: f.entityType, mode: 'insensitive' };
    if (f.action) where.action = { contains: f.action, mode: 'insensitive' };
    if (f.from || f.to) {
      where.createdAt = {};
      if (f.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(f.from);
      if (f.to) {
        const toDate = new Date(f.to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as Prisma.DateTimeFilter).lte = toDate;
      }
    }
    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: { user: { select: { id: true, fullName: true } } },
      }),
    ]);
    res.json({ total, page: f.page, pageSize: f.pageSize, items });
  } catch (err) {
    next(err);
  }
});

export default router;

