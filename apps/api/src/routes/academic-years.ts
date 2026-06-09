import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';

const router = Router();
router.use(requireAuth);

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Data non valida');

const createSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(20)
    .regex(/^\d{4}\/\d{4}$/, 'Formato richiesto: 2025/2026'),
  startDate: isoDate,
  endDate: isoDate,
  active: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

// GET /api/academic-years
router.get('/', async (_req, res, next) => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { memberships: true, courses: true } },
      },
    });
    res.json({
      years: years.map((y: any) => ({
        id: y.id,
        label: y.label,
        startDate: y.startDate,
        endDate: y.endDate,
        active: y.active,
        membershipsCount: y._count.memberships,
        coursesCount: y._count.courses,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/academic-years/current  — l'anno attivo (se esiste)
router.get('/current', async (_req, res, next) => {
  try {
    const year = await prisma.academicYear.findFirst({ where: { active: true } });
    res.json({ year });
  } catch (err) {
    next(err);
  }
});

// POST /api/academic-years  (ADMIN)
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx: any) => {
      if (data.active) {
        await tx.academicYear.updateMany({ data: { active: false }, where: { active: true } });
      }
      return tx.academicYear.create({
        data: {
          label: data.label,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          active: data.active ?? false,
        },
      });
    });
    await audit({
      userId: req.user!.userId,
      action: 'ACADEMIC_YEAR_CREATED',
      entityType: 'AcademicYear',
      entityId: created.id,
      payload: data,
    });
    res.status(201).json({ year: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/academic-years/:id  (ADMIN)
router.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      if (data.active === true) {
        await tx.academicYear.updateMany({
          data: { active: false },
          where: { active: true, NOT: { id: req.params.id } },
        });
      }
      return tx.academicYear.update({
        where: { id: req.params.id },
        data: {
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
          ...(data.endDate !== undefined ? { endDate: new Date(data.endDate) } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
      });
    });
    await audit({
      userId: req.user!.userId,
      action: 'ACADEMIC_YEAR_UPDATED',
      entityType: 'AcademicYear',
      entityId: updated.id,
      payload: data,
    });
    res.json({ year: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/academic-years/:id/activate  (ADMIN)
router.post('/:id/activate', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const year = await prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        data: { active: false },
        where: { active: true, NOT: { id: req.params.id } },
      });
      return tx.academicYear.update({
        where: { id: req.params.id },
        data: { active: true },
      });
    });
    await audit({
      userId: req.user!.userId,
      action: 'ACADEMIC_YEAR_ACTIVATED',
      entityType: 'AcademicYear',
      entityId: year.id,
    });
    res.json({ year });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/academic-years/:id  (ADMIN)
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const counts = await prisma.academicYear.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { memberships: true, courses: true, fees: true } } },
    });
    if (!counts) {
      res.status(404).json({ error: 'Anno accademico non trovato' });
      return;
    }
    if (counts._count.memberships > 0 || counts._count.courses > 0 || counts._count.fees > 0) {
      res.status(409).json({
        error:
          'Anno collegato a iscrizioni/corsi/quote: imposta solo come non attivo invece di eliminare',
      });
      return;
    }
    await prisma.academicYear.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'ACADEMIC_YEAR_DELETED',
      entityType: 'AcademicYear',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

