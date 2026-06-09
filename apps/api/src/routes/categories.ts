import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, 'Codice: solo A-Z, 0-9, _ in maiuscolo'),
  name: z.string().min(1).max(80),
  notes: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial();

// GET /api/categories
router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.memberCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    res.json({
      categories: categories.map((c: any) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        notes: c.notes,
        membersCount: c._count.members,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories  (ADMIN)
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.memberCategory.create({ data });
    await audit({
      userId: req.user!.userId,
      action: 'CATEGORY_CREATED',
      entityType: 'MemberCategory',
      entityId: created.id,
      payload: data,
    });
    res.status(201).json({ category: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/categories/:id  (ADMIN)
router.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.memberCategory.update({
      where: { id: req.params.id },
      data,
    });
    await audit({
      userId: req.user!.userId,
      action: 'CATEGORY_UPDATED',
      entityType: 'MemberCategory',
      entityId: updated.id,
      payload: data,
    });
    res.json({ category: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/categories/:id  (ADMIN)
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const inUse = await prisma.member.count({ where: { categoryId: req.params.id } });
    if (inUse > 0) {
      res.status(409).json({ error: `Categoria in uso da ${inUse} soci, impossibile eliminare` });
      return;
    }
    await prisma.memberCategory.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'CATEGORY_DELETED',
      entityType: 'MemberCategory',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

