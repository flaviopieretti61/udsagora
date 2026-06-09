import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';
import {
  membershipStatusSchema,
  membershipTypeSchema,
  paymentMethodSchema,
} from '../types/enums.js';

const router = Router();
router.use(requireAuth);

// -- Schemi ----------------------------------------------------------------

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Data non valida');

const createSchema = z.object({
  memberId: z.string().min(1),
  academicYearId: z.string().min(1),
  type: membershipTypeSchema,
  amountDueCents: z.number().int().nonnegative().optional(),
  amountPaidCents: z.number().int().nonnegative().optional(),
  paymentDate: optionalIsoDate,
  paymentMethod: paymentMethodSchema.optional(),
  receiptNumber: z.string().trim().min(1).optional(),
  note: z.string().optional(),
});

const updateSchema = z.object({
  type: membershipTypeSchema.optional(),
  amountDueCents: z.number().int().nonnegative().optional(),
  note: z.string().optional().nullable(),
});

const paymentSchema = z.object({
  amountPaidCents: z.number().int().nonnegative(),
  paymentDate: optionalIsoDate,
  paymentMethod: paymentMethodSchema.optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(500),
});

const listQuerySchema = z.object({
  status: membershipStatusSchema.optional(),
  type: membershipTypeSchema.optional(),
  academicYearId: z.string().optional(),
  memberId: z.string().optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.enum(['member', 'year', 'type', 'status']).default('member'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// -- Helpers ---------------------------------------------------------------

async function resolveFeeAmount(
  tx: Prisma.TransactionClient,
  academicYearId: string,
  categoryId: string,
  type: 'NUOVA' | 'RINNOVO',
): Promise<number | null> {
  const fee = await tx.membershipFee.findUnique({
    where: { academicYearId_categoryId_type: { academicYearId, categoryId, type } },
  });
  return fee?.amountCents ?? null;
}

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

// -- Routes ----------------------------------------------------------------

// GET /api/memberships
router.get('/', async (req, res, next) => {
  try {
    const f = listQuerySchema.parse(req.query);
    const where: Prisma.MembershipWhereInput = {};
    if (f.status) where.status = f.status;
    if (f.type) where.type = f.type;
    if (f.academicYearId) where.academicYearId = f.academicYearId;
    if (f.memberId) where.memberId = f.memberId;
    if (f.q) {
      where.member = {
        OR: [
          { cognome: { contains: f.q, mode: 'insensitive' } },
          { nome: { contains: f.q, mode: 'insensitive' } },
          { codiceFiscale: { contains: f.q.toUpperCase(), mode: 'insensitive' } },
        ],
      };
    }

    const orderBy: Prisma.MembershipOrderByWithRelationInput[] = [];
    if (f.sortBy === 'member') {
      orderBy.push({ member: { cognome: f.sortOrder } }, { member: { nome: 'asc' } });
    } else if (f.sortBy === 'year') {
      orderBy.push({ academicYear: { label: f.sortOrder } });
    } else if (f.sortBy === 'type') {
      orderBy.push({ type: f.sortOrder });
    } else if (f.sortBy === 'status') {
      orderBy.push({ status: f.sortOrder });
    }
    orderBy.push({ createdAt: 'desc' });

    const [total, items] = await Promise.all([
      prisma.membership.count({ where }),
      prisma.membership.findMany({
        where,
        orderBy,
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: {
          member: {
            select: {
              id: true,
              cognome: true,
              nome: true,
              category: { select: { id: true, code: true, name: true } },
            },
          },
          academicYear: { select: { id: true, label: true } },
          approvedBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);
    res.json({ total, page: f.page, pageSize: f.pageSize, items });
  } catch (err) {
    next(err);
  }
});

// GET /api/memberships/:id
router.get('/:id', async (req, res, next) => {
  try {
    const m = await prisma.membership.findUnique({
      where: { id: req.params.id },
      include: {
        member: { include: { category: true } },
        academicYear: true,
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!m) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    res.json({ membership: m });
  } catch (err) {
    next(err);
  }
});

// POST /api/memberships
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    if (data.paymentDate) {
      const lock = await checkDataLock(data.academicYearId, new Date(data.paymentDate));
      if (lock.locked) {
        res.status(409).json({ error: lock.message });
        return;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({
        where: { id: data.memberId },
        select: { id: true, categoryId: true },
      });
      if (!member) throw new Error('Socio non trovato');

      let amountDue = data.amountDueCents;
      if (amountDue === undefined) {
        const fromFee = await resolveFeeAmount(
          tx,
          data.academicYearId,
          member.categoryId,
          data.type,
        );
        if (fromFee === null) {
          throw new Error(
            "Quota non configurata per questa combinazione anno/categoria/tipo: imposta l'importo a mano",
          );
        }
        amountDue = fromFee;
      }

      return tx.membership.create({
        data: {
          memberId: data.memberId,
          academicYearId: data.academicYearId,
          type: data.type,
          amountDueCents: amountDue,
          amountPaidCents: data.amountPaidCents ?? 0,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
          paymentMethod: data.paymentMethod,
          receiptNumber: data.receiptNumber,
          note: data.note,
          status: 'IN_ATTESA',
        },
      });
    });

    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_CREATED',
      entityType: 'Membership',
      entityId: created.id,
      payload: { type: created.type, amountDueCents: created.amountDueCents },
    });
    res.status(201).json({ membership: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    if (err instanceof Error && (err.message.includes('non trovato') || err.message.includes('Quota non configurata'))) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// PATCH /api/memberships/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const current = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status === 'RIFIUTATA' || current.status === 'ANNULLATA') {
      res
        .status(409)
        .json({ error: 'Iscrizione rifiutata/annullata: modifica non consentita' });
      return;
    }
    const updated = await prisma.membership.update({
      where: { id: req.params.id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.amountDueCents !== undefined ? { amountDueCents: data.amountDueCents } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_UPDATED',
      entityType: 'Membership',
      entityId: updated.id,
      payload: data,
    });
    res.json({ membership: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/memberships/:id/approve  (CONSIGLIO/ADMIN)
router.post('/:id/approve', requireRole('CONSIGLIO', 'ADMIN'), async (req, res, next) => {
  try {
    const current = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status !== 'IN_ATTESA') {
      res.status(409).json({ error: `Stato corrente "${current.status}": non approvabile` });
      return;
    }
    const updated = await prisma.membership.update({
      where: { id: current.id },
      data: {
        status: 'APPROVATA',
        approvedById: req.user!.userId,
        approvedAt: new Date(),
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_APPROVED',
      entityType: 'Membership',
      entityId: updated.id,
    });
    res.json({ membership: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/memberships/:id/reject  (CONSIGLIO/ADMIN)
router.post('/:id/reject', requireRole('CONSIGLIO', 'ADMIN'), async (req, res, next) => {
  try {
    const { rejectionReason } = rejectSchema.parse(req.body);
    const current = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status !== 'IN_ATTESA') {
      res.status(409).json({ error: `Stato corrente "${current.status}": non rifiutabile` });
      return;
    }
    const updated = await prisma.membership.update({
      where: { id: current.id },
      data: {
        status: 'RIFIUTATA',
        rejectionReason,
        approvedById: req.user!.userId,
        approvedAt: new Date(),
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_REJECTED',
      entityType: 'Membership',
      entityId: updated.id,
      payload: { rejectionReason },
    });
    res.json({ membership: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/memberships/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const current = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status === 'RIFIUTATA' || current.status === 'ANNULLATA') {
      res.status(409).json({ error: 'Iscrizione già chiusa' });
      return;
    }
    const updated = await prisma.membership.update({
      where: { id: current.id },
      data: {
        status: 'ANNULLATA',
        approvedById: req.user!.userId,
        approvedAt: new Date(),
      },
      include: {
        member: {
          select: {
            id: true,
            cognome: true,
            nome: true,
            category: { select: { id: true, code: true, name: true } },
          },
        },
        academicYear: { select: { id: true, label: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_CANCELED',
      entityType: 'Membership',
      entityId: updated.id,
    });
    res.json({ membership: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/memberships/:id/payment
router.post('/:id/payment', async (req, res, next) => {
  try {
    const data = paymentSchema.parse(req.body);
    const current = await prisma.membership.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, academicYearId: true },
    });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status === 'RIFIUTATA' || current.status === 'ANNULLATA') {
      res.status(409).json({ error: 'Iscrizione chiusa: impossibile registrare pagamento' });
      return;
    }

    if (data.paymentDate) {
      const lock = await checkDataLock(current.academicYearId, new Date(data.paymentDate));
      if (lock.locked) {
        res.status(409).json({ error: lock.message });
        return;
      }
    }
    const updated = await prisma.membership.update({
      where: { id: current.id },
      data: {
        amountPaidCents: data.amountPaidCents,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        paymentMethod: data.paymentMethod ?? null,
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_PAYMENT',
      entityType: 'Membership',
      entityId: updated.id,
      payload: data,
    });
    res.json({ membership: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/memberships/:id  — solo se IN_ATTESA o ANNULLATA
router.delete('/:id', async (req, res, next) => {
  try {
    const current = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Iscrizione non trovata' });
      return;
    }
    if (current.status !== 'IN_ATTESA' && current.status !== 'ANNULLATA') {
      res
        .status(409)
        .json({ error: `Iscrizione con stato "${current.status}" non può essere eliminata` });
      return;
    }
    await prisma.membership.delete({ where: { id: current.id } });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBERSHIP_DELETED',
      entityType: 'Membership',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

