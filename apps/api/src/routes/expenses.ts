import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';

const router = Router();
router.use(requireAuth);

const isoDate = z.string().refine(
  (s) => !Number.isNaN(Date.parse(s)),
  'Data non valida',
);

const createSchema = z.object({
  expenseDate: isoDate,
  description: z.string().min(1).max(500),
  spenderName: z.string().min(1),
  amountCents: z.number().int().positive(),
});

const updateSchema = createSchema.partial();

async function checkDataLockForExpense(expenseDate: Date): Promise<{ locked: boolean; message?: string }> {
  const lastClosure = await prisma.cashClosing.findFirst({
    orderBy: { closureDate: 'desc' },
    select: { closureDate: true },
  });

  if (!lastClosure) return { locked: false };

  const expenseDateOnly = new Date(expenseDate.toISOString().split('T')[0]);
  const closureDateOnly = new Date(lastClosure.closureDate.toISOString().split('T')[0]);

  if (expenseDateOnly <= closureDateOnly) {
    return {
      locked: true,
      message: 'Data chiusura bloccata - esiste una chiusura di cassa per questa data o precedente. Contattare l\'amministratore se è necessario modificare dati retroattivi.',
    };
  }

  return { locked: false };
}

// GET /api/expenses
router.get('/', async (_req, res, next) => {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { expenseDate: 'desc' },
      include: { user: { select: { username: true, fullName: true } } },
    });
    res.json({ expenses });
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/:id
router.get('/:id', async (req, res, next) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { username: true, fullName: true } } },
    });
    if (!expense) {
      res.status(404).json({ error: 'Spesa non trovata' });
      return;
    }
    res.json({ expense });
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    const lock = await checkDataLockForExpense(new Date(data.expenseDate));
    if (lock.locked) {
      res.status(409).json({ error: lock.message });
      return;
    }

    const created = await prisma.expense.create({
      data: {
        expenseDate: new Date(data.expenseDate),
        description: data.description,
        spenderName: data.spenderName,
        amountCents: data.amountCents,
        userId: req.user!.userId,
      },
      include: { user: { select: { username: true, fullName: true } } },
    });
    await audit({
      userId: req.user!.userId,
      action: 'EXPENSE_CREATED',
      entityType: 'Expense',
      entityId: created.id,
      payload: data,
    });
    res.status(201).json({ expense: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/expenses/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);

    if (data.expenseDate) {
      const lock = await checkDataLockForExpense(new Date(data.expenseDate));
      if (lock.locked) {
        res.status(409).json({ error: lock.message });
        return;
      }
    }

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...(data.expenseDate !== undefined ? { expenseDate: new Date(data.expenseDate) } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.spenderName !== undefined ? { spenderName: data.spenderName } : {}),
        ...(data.amountCents !== undefined ? { amountCents: data.amountCents } : {}),
      },
      include: { user: { select: { username: true, fullName: true } } },
    });
    await audit({
      userId: req.user!.userId,
      action: 'EXPENSE_UPDATED',
      entityType: 'Expense',
      entityId: updated.id,
      payload: data,
    });
    res.json({ expense: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) {
      res.status(404).json({ error: 'Spesa non trovata' });
      return;
    }
    await prisma.expense.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'EXPENSE_DELETED',
      entityType: 'Expense',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;
