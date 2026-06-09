import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';
import { membershipTypeSchema } from '../types/enums.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  academicYearId: z.string().min(1),
  categoryId: z.string().min(1),
  type: membershipTypeSchema,
  amountCents: z.number().int().nonnegative(),
});

const updateSchema = z.object({
  amountCents: z.number().int().nonnegative(),
});

// GET /api/membership-fees?academicYearId=...
router.get('/', async (req, res, next) => {
  try {
    const academicYearId = z.string().optional().parse(req.query.academicYearId);
    const fees = await prisma.membershipFee.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      include: {
        category: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, label: true } },
      },
      orderBy: [{ academicYearId: 'desc' }, { type: 'asc' }, { category: { name: 'asc' } }],
    });
    res.json({ fees });
  } catch (err) {
    next(err);
  }
});

// POST /api/membership-fees  (ADMIN)
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.membershipFee.create({ data });
    await audit({
      userId: req.user!.userId,
      action: 'FEE_CREATED',
      entityType: 'MembershipFee',
      entityId: created.id,
      payload: data,
    });
    res.status(201).json({ fee: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/membership-fees/:id  (ADMIN)
router.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.membershipFee.update({
      where: { id: req.params.id },
      data,
    });
    await audit({
      userId: req.user!.userId,
      action: 'FEE_UPDATED',
      entityType: 'MembershipFee',
      entityId: updated.id,
      payload: data,
    });
    res.json({ fee: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/membership-fees/:id  (ADMIN)
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.membershipFee.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'FEE_DELETED',
      entityType: 'MembershipFee',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

