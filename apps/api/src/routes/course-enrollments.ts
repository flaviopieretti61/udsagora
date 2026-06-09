import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';
import { paymentMethodSchema } from '../types/enums.js';

const router = Router();
router.use(requireAuth);

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Data non valida');

const createSchema = z.object({
  courseId: z.string().min(1),
  memberId: z.string().min(1),
  amountDueCents: z.number().int().nonnegative().optional(),
  amountPaidCents: z.number().int().nonnegative().optional(),
  paymentDate: optionalIsoDate,
  paymentMethod: paymentMethodSchema.optional(),
  receiptNumber: z.string().trim().min(1).optional(),
  note: z.string().optional(),
});

const paymentSchema = z.object({
  amountPaidCents: z.number().int().nonnegative(),
  paymentDate: optionalIsoDate,
  paymentMethod: paymentMethodSchema.optional(),
});

const listQuerySchema = z.object({
  courseId: z.string().optional(),
  memberId: z.string().optional(),
});

async function checkDataLock(academicYearId: string, paymentDate?: Date): Promise<{ locked: boolean; message?: string }> {
  if (!paymentDate) return { locked: false };

  const lastClosure = await prisma.cashClosing.findFirst({
    where: { academicYearId },
    orderBy: { closureDate: 'desc' },
    select: { closureDate: true },
  });

  if (!lastClosure) return { locked: false };

  const paymentDateOnly = new Date(paymentDate.toISOString().split('T')[0]);
  const closureDateOnly = new Date(lastClosure.closureDate.toISOString().split('T')[0]);

  if (paymentDateOnly <= closureDateOnly) {
    return {
      locked: true,
      message: 'Data chiusura bloccata - esiste una chiusura di cassa per questa data o precedente. Contattare l\'amministratore se è necessario modificare dati retroattivi.',
    };
  }

  return { locked: false };
}

// GET /api/course-enrollments
router.get('/', async (req, res, next) => {
  try {
    const f = listQuerySchema.parse(req.query);
    const where: Prisma.CourseEnrollmentWhereInput = {};
    if (f.courseId) where.courseId = f.courseId;
    if (f.memberId) where.memberId = f.memberId;
    const items = await prisma.courseEnrollment.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        course: { include: { academicYear: { select: { id: true, label: true } } } },
        member: {
          select: {
            id: true,
            cognome: true,
            nome: true,
            codiceFiscale: true,
            email: true,
            category: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// POST /api/course-enrollments
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: data.courseId },
        include: { academicYear: { select: { id: true } } },
      });
      if (!course) throw new Error('Corso non trovato');
      if (course.status === 'ANNULLATO' || course.status === 'CHIUSO') {
        throw new Error(`Corso in stato "${course.status}": iscrizioni non consentite`);
      }
      if (course.postiMassimi !== null && course.postiMassimi !== undefined) {
        const activeCount = await tx.courseEnrollment.count({
          where: { courseId: course.id, status: 'ATTIVA' },
        });
        if (activeCount >= course.postiMassimi) {
          throw new Error('Posti esauriti per questo corso');
        }
      }

      const member = await tx.member.findUnique({ where: { id: data.memberId } });
      if (!member) throw new Error('Socio non trovato');

      // Controlla se il socio ha iscrizione APPROVATA per l'anno del corso
      const approvedMembership = await tx.membership.findFirst({
        where: {
          memberId: member.id,
          academicYearId: course.academicYearId,
          status: 'APPROVATA',
        },
      });
      const warning = !approvedMembership
        ? 'Il socio non ha una tessera APPROVATA per l\'anno accademico di questo corso'
        : undefined;

      // Check data lock before creating enrollment with payment date
      if (data.paymentDate) {
        const lock = await checkDataLock(course.academicYear.id, new Date(data.paymentDate));
        if (lock.locked) {
          throw new Error(lock.message);
        }
      }

      const enrollment = await tx.courseEnrollment.create({
        data: {
          courseId: course.id,
          memberId: member.id,
          amountDueCents: data.amountDueCents ?? course.costoCents,
          amountPaidCents: data.amountPaidCents ?? 0,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
          paymentMethod: data.paymentMethod,
          receiptNumber: data.receiptNumber,
          note: data.note,
          status: 'ATTIVA',
        },
      });

      return { enrollment, warning };
    });

    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ENROLLMENT_CREATED',
      entityType: 'CourseEnrollment',
      entityId: result.enrollment.id,
      payload: { courseId: data.courseId, memberId: data.memberId },
    });
    res.status(201).json({
      enrollment: result.enrollment,
      warning: result.warning,
    });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    if (err instanceof Error) {
      if (
        err.message.includes('non trovato') ||
        err.message.includes('non consentite') ||
        err.message.includes('Posti esauriti')
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
    }
    next(err);
  }
});

// POST /api/course-enrollments/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const current = await prisma.courseEnrollment.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status === 'ANNULLATA') {
      res.status(409).json({ error: 'Iscrizione già annullata' });
      return;
    }
    const updated = await prisma.courseEnrollment.update({
      where: { id: current.id },
      data: { status: 'ANNULLATA' },
    });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ENROLLMENT_CANCELED',
      entityType: 'CourseEnrollment',
      entityId: updated.id,
    });
    res.json({ enrollment: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/course-enrollments/:id/restore
router.post('/:id/restore', async (req, res, next) => {
  try {
    const current = await prisma.courseEnrollment.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status !== 'ANNULLATA') {
      res.status(409).json({ error: 'Iscrizione non è annullata' });
      return;
    }
    // Verificare posti disponibili del corso
    const course = await prisma.course.findUnique({ where: { id: current.courseId } });
    if (course && course.postiMassimi) {
      const activeCount = await prisma.courseEnrollment.count({
        where: { courseId: course.id, status: 'ATTIVA' },
      });
      if (activeCount >= course.postiMassimi) {
        res.status(409).json({ error: 'Posti massimi raggiunti per il corso' });
        return;
      }
    }
    const updated = await prisma.courseEnrollment.update({
      where: { id: current.id },
      data: { status: 'ATTIVA' },
    });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ENROLLMENT_RESTORED',
      entityType: 'CourseEnrollment',
      entityId: updated.id,
    });
    res.json({ enrollment: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/course-enrollments/:id/payment
router.post('/:id/payment', async (req, res, next) => {
  try {
    const data = paymentSchema.parse(req.body);
    const current = await prisma.courseEnrollment.findUnique({
      where: { id: req.params.id },
      include: { course: { include: { academicYear: { select: { id: true } } } } },
    });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status === 'ANNULLATA') {
      res.status(409).json({ error: 'Iscrizione annullata: impossibile registrare pagamento' });
      return;
    }

    if (data.paymentDate) {
      const lock = await checkDataLock(current.course.academicYear.id, new Date(data.paymentDate));
      if (lock.locked) {
        res.status(409).json({ error: lock.message });
        return;
      }
    }
    const updated = await prisma.courseEnrollment.update({
      where: { id: current.id },
      data: {
        amountPaidCents: data.amountPaidCents,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        paymentMethod: data.paymentMethod ?? null,
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ENROLLMENT_PAYMENT',
      entityType: 'CourseEnrollment',
      entityId: updated.id,
      payload: data,
    });
    res.json({ enrollment: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/course-enrollments/:id  — solo se ANNULLATA
router.delete('/:id', async (req, res, next) => {
  try {
    const current = await prisma.courseEnrollment.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status !== 'ANNULLATA') {
      res
        .status(409)
        .json({ error: `Solo iscrizioni annullate possono essere eliminate` });
      return;
    }
    await prisma.courseEnrollment.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ENROLLMENT_DELETED',
      entityType: 'CourseEnrollment',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

