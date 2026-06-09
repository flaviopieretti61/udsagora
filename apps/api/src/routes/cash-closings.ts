import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { generateCashClosingPDF } from '../lib/pdf-cash-closing.js';
import { generateCashClosingExcel } from '../lib/excel-cash-closing.js';

const router = Router();
router.use(requireAuth);

// Validation schemas
const denominationSchema = z.object({
  denominationCents: z.number().int().positive(),
  quantity: z.number().int().nonnegative(),
});

const createSchema = z.object({
  closureDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Data non valida'),
  academicYearId: z.string().min(1, 'Anno accademico obbligatorio'),
  countedCashTotal: z.number().int().nonnegative(),
  pettyCashRemaining: z.number().int().nonnegative(),
  bankDepositNumber: z.string().optional(),
  bankDepositDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  denominationCounts: z.array(denominationSchema),
});

const updateSchema = createSchema.partial();

/**
 * Computes the expected cash figures for a given closure date and academic year.
 * Single source of truth shared by GET /expected, POST and PATCH so the
 * calculation can never drift between them.
 *
 * expectedCashTotal = previousPettyCash + memberships + courses - expenses
 * (the previous day's leftover petty cash is physically already in the drawer,
 *  so it is part of what we expect to count today)
 */
async function computeExpected(closureDate: Date, academicYearId: string, excludeClosingId?: string) {
  const [expectedMemberships, expectedCourses, expenses, previous] = await Promise.all([
    prisma.membership.aggregate({
      where: {
        academicYearId,
        paymentDate: closureDate,
        paymentMethod: 'CONTANTI',
        status: { in: ['IN_ATTESA', 'APPROVATA'] },
      },
      _sum: { amountPaidCents: true },
    }),
    prisma.courseEnrollment.aggregate({
      where: {
        course: { academicYearId },
        paymentDate: closureDate,
        paymentMethod: 'CONTANTI',
        status: 'ATTIVA',
      },
      _sum: { amountPaidCents: true },
    }),
    prisma.expense.aggregate({
      where: { expenseDate: closureDate },
      _sum: { amountCents: true },
    }),
    // Most recent closure strictly before this date (the "previous closure"),
    // optionally excluding the closure currently being edited.
    prisma.cashClosing.findFirst({
      where: {
        academicYearId,
        closureDate: { lt: closureDate },
        ...(excludeClosingId ? { id: { not: excludeClosingId } } : {}),
      },
      orderBy: { closureDate: 'desc' },
      select: { pettyCashRemaining: true },
    }),
  ]);

  const expectedCashFromMemberships = expectedMemberships._sum.amountPaidCents || 0;
  const expectedCashFromCourses = expectedCourses._sum.amountPaidCents || 0;
  const totalExpenses = expenses._sum.amountCents || 0;
  const previousPettyCash = previous?.pettyCashRemaining || 0;
  const expectedCashTotal =
    previousPettyCash + expectedCashFromMemberships + expectedCashFromCourses - totalExpenses;

  return {
    expectedCashFromMemberships,
    expectedCashFromCourses,
    totalExpenses,
    previousPettyCash,
    expectedCashTotal,
  };
}

// GET: Last closure date (for data lock checking)
router.get('/last', async (req, res, next) => {
  try {
    const lastClosure = await prisma.cashClosing.findFirst({
      orderBy: { closureDate: 'desc' },
      select: { closureDate: true },
    });

    res.json({ lastClosureDate: lastClosure?.closureDate || null });
  } catch (err) {
    next(err);
  }
});

// GET: Expected cash for a date and year (for calculation before saving)
router.get('/expected/:dateStr/:yearId', async (req, res, next) => {
  try {
    const { dateStr, yearId } = req.params;
    if (Number.isNaN(Date.parse(dateStr))) {
      res.status(400).json({ error: 'Data non valida' });
      return;
    }
    const closureDate = new Date(`${dateStr}T00:00:00Z`);
    const expected = await computeExpected(closureDate, yearId);
    res.json(expected);
  } catch (err) {
    next(err);
  }
});

// GET: History of previous closures
// NOTE: declared BEFORE the catch-all '/:date?' so a request to /history/:yearId
// is not swallowed by the date route (which would parse "history" as a date).
router.get('/history/:yearId', async (req, res, next) => {
  try {
    const { yearId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

    const closures = await prisma.cashClosing.findMany({
      where: { academicYearId: yearId },
      orderBy: { closureDate: 'desc' },
      take: limit,
      include: { denominationCounts: true, user: { select: { fullName: true } } },
    });

    res.json(closures);
  } catch (err) {
    next(err);
  }
});

// GET: Closure for specific date or today
router.get('/:date?', async (req, res, next) => {
  try {
    const dateStr = req.params.date || new Date().toISOString().split('T')[0];
    if (Number.isNaN(Date.parse(dateStr))) {
      res.status(400).json({ error: 'Data non valida' });
      return;
    }
    const closureDate = new Date(`${dateStr}T00:00:00Z`);

    const closure = await prisma.cashClosing.findFirst({
      where: { closureDate: { equals: closureDate } },
      include: { denominationCounts: true, academicYear: { select: { id: true } } },
    });

    if (closure) {
      res.json(closure);
      return;
    }

    // If no closure exists, return null (frontend will handle calculating expected cash)
    res.json(null);
  } catch (err) {
    next(err);
  }
});

// POST: Create new closure
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const closureDate = new Date(`${data.closureDate}T00:00:00Z`);

    // The counted total must equal the sum of the denomination breakdown.
    const denomSum = data.denominationCounts.reduce(
      (sum, d) => sum + d.denominationCents * d.quantity,
      0,
    );
    if (denomSum !== data.countedCashTotal) {
      res.status(400).json({
        error: 'Il totale rilevato non corrisponde alla somma dei tagli conteggiati',
      });
      return;
    }

    // The petty cash kept aside cannot exceed the cash actually counted.
    if (data.pettyCashRemaining > data.countedCashTotal) {
      res.status(400).json({
        error: 'Il fondo cassa restante non può superare il contante rilevato',
      });
      return;
    }

    // Check if closure already exists for this date
    const existing = await prisma.cashClosing.findFirst({
      where: { closureDate, academicYearId: data.academicYearId },
    });

    if (existing) {
      res.status(409).json({ error: 'Chiusura di cassa già esistente per questa data' });
      return;
    }

    const expected = await computeExpected(closureDate, data.academicYearId);
    const difference = data.countedCashTotal - expected.expectedCashTotal;
    const bankDepositAmount = Math.max(0, data.countedCashTotal - data.pettyCashRemaining);

    // Create closure with denominations in transaction
    const closure = await prisma.$transaction(async (tx) => {
      const created = await tx.cashClosing.create({
        data: {
          closureDate,
          academicYearId: data.academicYearId,
          expectedCashFromMemberships: expected.expectedCashFromMemberships,
          expectedCashFromCourses: expected.expectedCashFromCourses,
          expensesTotal: expected.totalExpenses,
          previousPettyCash: expected.previousPettyCash,
          countedCashTotal: data.countedCashTotal,
          pettyCashRemaining: data.pettyCashRemaining,
          bankDepositAmount,
          bankDepositNumber: data.bankDepositNumber || null,
          bankDepositDate: data.bankDepositDate ? new Date(`${data.bankDepositDate}T00:00:00Z`) : null,
          difference,
          notes: data.notes || null,
          userId: req.user!.userId,
        },
      });

      // Create denomination records
      for (const denom of data.denominationCounts) {
        const subtotal = denom.denominationCents * denom.quantity;
        await tx.cashClosingDenomination.create({
          data: {
            cashClosingId: created.id,
            denominationCents: denom.denominationCents,
            quantity: denom.quantity,
            subtotal,
          },
        });
      }

      return await tx.cashClosing.findUnique({
        where: { id: created.id },
        include: { denominationCounts: true },
      });
    });

    // Audit log
    await audit({
      userId: req.user!.userId,
      action: 'CASH_CLOSING_CREATED',
      entityType: 'CashClosing',
      entityId: closure!.id,
      payload: { closureDate: data.closureDate, difference, amountCents: data.countedCashTotal },
    });

    res.status(201).json(closure);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validazione fallita', details: err.errors });
      return;
    }
    // Concurrent POST losing the unique-constraint race → clean 409.
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'Chiusura di cassa già esistente per questa data' });
      return;
    }
    next(err);
  }
});

// PATCH: Update closure
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);

    const existing = await prisma.cashClosing.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Chiusura di cassa non trovata' });
      return;
    }

    // DATA LOCK (C2): a closure can only be edited while it is the most recent
    // one. If a later closure exists, this record is "locked" — editing it would
    // invalidate the previousPettyCash carried into every subsequent closure.
    const laterClosure = await prisma.cashClosing.findFirst({
      where: {
        academicYearId: existing.academicYearId,
        closureDate: { gt: existing.closureDate },
      },
      select: { id: true },
    });
    if (laterClosure) {
      res.status(409).json({
        error:
          'Chiusura bloccata: esiste una chiusura successiva. Non è possibile modificare una chiusura precedente.',
      });
      return;
    }

    const closureDate = data.closureDate ? new Date(`${data.closureDate}T00:00:00Z`) : existing.closureDate;
    const countedCashTotal = data.countedCashTotal ?? existing.countedCashTotal;
    const pettyCashRemaining = data.pettyCashRemaining ?? existing.pettyCashRemaining;

    // Validate denomination sum and petty-cash bound against the resulting total.
    if (data.denominationCounts) {
      const denomSum = data.denominationCounts.reduce(
        (sum, d) => sum + d.denominationCents * d.quantity,
        0,
      );
      if (denomSum !== countedCashTotal) {
        res.status(400).json({
          error: 'Il totale rilevato non corrisponde alla somma dei tagli conteggiati',
        });
        return;
      }
    }
    if (pettyCashRemaining > countedCashTotal) {
      res.status(400).json({
        error: 'Il fondo cassa restante non può superare il contante rilevato',
      });
      return;
    }

    // If the date changed, guard against colliding with an existing closure.
    if (data.closureDate && closureDate.getTime() !== existing.closureDate.getTime()) {
      const collision = await prisma.cashClosing.findFirst({
        where: { closureDate, academicYearId: existing.academicYearId, id: { not: id } },
        select: { id: true },
      });
      if (collision) {
        res.status(409).json({ error: 'Chiusura di cassa già esistente per questa data' });
        return;
      }
    }

    // Recompute ALL expected figures from the (possibly new) date using the same
    // helper as POST, so the stored difference can never drift (fix C3). Exclude
    // this closure when looking up the previous one.
    const expected = await computeExpected(closureDate, existing.academicYearId, id);
    const difference = countedCashTotal - expected.expectedCashTotal;
    const bankDepositAmount = Math.max(0, countedCashTotal - pettyCashRemaining);

    // Update closure and denominations in transaction
    const updated = await prisma.$transaction(async (tx) => {
      await tx.cashClosing.update({
        where: { id },
        data: {
          closureDate,
          countedCashTotal,
          pettyCashRemaining,
          expectedCashFromMemberships: expected.expectedCashFromMemberships,
          expectedCashFromCourses: expected.expectedCashFromCourses,
          expensesTotal: expected.totalExpenses,
          previousPettyCash: expected.previousPettyCash,
          bankDepositAmount,
          difference,
          ...(data.bankDepositNumber !== undefined && { bankDepositNumber: data.bankDepositNumber || null }),
          ...(data.bankDepositDate !== undefined && {
            bankDepositDate: data.bankDepositDate ? new Date(`${data.bankDepositDate}T00:00:00Z`) : null,
          }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
        },
      });

      // Update denominations if provided
      if (data.denominationCounts) {
        await tx.cashClosingDenomination.deleteMany({ where: { cashClosingId: id } });

        for (const denom of data.denominationCounts) {
          const subtotal = denom.denominationCents * denom.quantity;
          await tx.cashClosingDenomination.create({
            data: {
              cashClosingId: id,
              denominationCents: denom.denominationCents,
              quantity: denom.quantity,
              subtotal,
            },
          });
        }
      }

      return await tx.cashClosing.findUnique({
        where: { id },
        include: { denominationCounts: true },
      });
    });

    // Audit log
    await audit({
      userId: req.user!.userId,
      action: 'CASH_CLOSING_UPDATED',
      entityType: 'CashClosing',
      entityId: id,
      payload: { difference, amountCents: countedCashTotal },
    });

    res.json(updated);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validazione fallita', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /api/cash-closings/:id/export/pdf
router.get('/:id/export/pdf', async (req, res, next) => {
  try {
    const closure = await prisma.cashClosing.findUnique({
      where: { id: req.params.id },
      include: { denominationCounts: true, user: { select: { fullName: true } }, academicYear: { select: { label: true } } },
    });

    if (!closure) {
      res.status(404).json({ error: 'Chiusura di cassa non trovata' });
      return;
    }

    const pdfBuffer = await generateCashClosingPDF({
      closureDate: closure.closureDate.toISOString().split('T')[0],
      academicYearLabel: closure.academicYear.label,
      operatorName: closure.user.fullName,
      expectedCashFromMemberships: closure.expectedCashFromMemberships,
      expectedCashFromCourses: closure.expectedCashFromCourses,
      expensesTotal: closure.expensesTotal,
      previousPettyCash: closure.previousPettyCash,
      countedCashTotal: closure.countedCashTotal,
      pettyCashRemaining: closure.pettyCashRemaining,
      bankDepositAmount: closure.bankDepositAmount,
      bankDepositNumber: closure.bankDepositNumber || undefined,
      bankDepositDate: closure.bankDepositDate ? closure.bankDepositDate.toISOString().split('T')[0] : undefined,
      difference: closure.difference,
      notes: closure.notes || undefined,
      denominationCounts: closure.denominationCounts.map((d) => ({
        denominationCents: d.denominationCents,
        quantity: d.quantity,
        subtotal: d.subtotal,
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="chiusura_cassa_${closure.closureDate.toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/cash-closings/:id/export/excel
router.get('/:id/export/excel', async (req, res, next) => {
  try {
    const closure = await prisma.cashClosing.findUnique({
      where: { id: req.params.id },
      include: { denominationCounts: true, user: { select: { fullName: true } }, academicYear: { select: { label: true } } },
    });

    if (!closure) {
      res.status(404).json({ error: 'Chiusura di cassa non trovata' });
      return;
    }

    const excelBuffer = generateCashClosingExcel({
      closureDate: closure.closureDate.toISOString().split('T')[0],
      academicYearLabel: closure.academicYear.label,
      operatorName: closure.user.fullName,
      expectedCashFromMemberships: closure.expectedCashFromMemberships,
      expectedCashFromCourses: closure.expectedCashFromCourses,
      expensesTotal: closure.expensesTotal,
      previousPettyCash: closure.previousPettyCash,
      countedCashTotal: closure.countedCashTotal,
      pettyCashRemaining: closure.pettyCashRemaining,
      bankDepositAmount: closure.bankDepositAmount,
      bankDepositNumber: closure.bankDepositNumber || undefined,
      bankDepositDate: closure.bankDepositDate ? closure.bankDepositDate.toISOString().split('T')[0] : undefined,
      difference: closure.difference,
      notes: closure.notes || undefined,
      denominationCounts: closure.denominationCounts.map((d) => ({
        denominationCents: d.denominationCents,
        quantity: d.quantity,
        subtotal: d.subtotal,
      })),
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="chiusura_cassa_${closure.closureDate.toISOString().split('T')[0]}.xlsx"`);
    res.send(excelBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
