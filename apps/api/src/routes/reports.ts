import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { generateRevenueReportPDF } from '../lib/pdf-revenue-report.js';
import { generateEnrollmentsDetailPDF } from '../lib/pdf-enrollments-detail.js';

const router = Router();
router.use(requireAuth);

const yearQuery = z.object({
  academicYearId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

async function resolveYearId(provided?: string): Promise<string | undefined> {
  if (provided) return provided;
  const active = await prisma.academicYear.findFirst({ where: { active: true } });
  return active?.id;
}

// GET /api/reports/revenue?academicYearId=...&dateFrom=...&dateTo=...
router.get('/revenue', async (req, res, next) => {
  try {
    const { academicYearId, dateFrom, dateTo } = yearQuery.parse(req.query);
    const yearId = await resolveYearId(academicYearId);
    if (!yearId) {
      res.json({
        academicYear: null,
        memberships: [],
        courses: [],
        byPaymentMethod: [],
        canceledEnrollments: [],
        totals: null,
      });
      return;
    }

    const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lt: new Date(new Date(dateTo).getTime() + 86400000) }), // +1 giorno per includere tutto il giorno
    };

    // Tessere APPROVATE con pagamento filtreto per data
    const approvedMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: 'APPROVATA',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { include: { category: true } } },
    });
    const byCategory = new Map<
      string,
      { categoryId: string; categoryName: string; count: number; due: number; paid: number }
    >();
    for (const m of approvedMemberships) {
      const k = m.member.category.id;
      const cur = byCategory.get(k) ?? {
        categoryId: k,
        categoryName: m.member.category.name,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += m.amountDueCents;
      cur.paid += m.amountPaidCents;
      byCategory.set(k, cur);
    }

    // Tessere IN_ATTESA con pagamento filtreto per data
    const pendingMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: 'IN_ATTESA',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { include: { category: true } } },
    });
    const pendingByCategory = new Map<
      string,
      { categoryId: string; categoryName: string; count: number; due: number; paid: number }
    >();
    for (const m of pendingMemberships) {
      const k = m.member.category.id;
      const cur = pendingByCategory.get(k) ?? {
        categoryId: k,
        categoryName: m.member.category.name,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += m.amountDueCents;
      cur.paid += m.amountPaidCents;
      pendingByCategory.set(k, cur);
    }

    // Corsi: aggregazione per corso
    const courses = await prisma.course.findMany({
      where: { academicYearId: yearId },
      include: {
        enrollments: {
          where: {
            status: 'ATTIVA',
            ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
          },
          select: { amountDueCents: true, amountPaidCents: true },
        },
      },
      orderBy: { dataInizio: 'asc' },
    });
    const coursesAgg = courses
      .map((c: any) => {
        const count = c.enrollments.length;
        const due = c.enrollments.reduce((acc: number, e: any) => acc + e.amountDueCents, 0);
        const paid = c.enrollments.reduce((acc: number, e: any) => acc + e.amountPaidCents, 0);
        return {
          courseId: c.id,
          titolo: c.titolo,
          status: c.status,
          count,
          dueCents: due,
          paidCents: paid,
        };
      })
      .filter((c: any) => c.count > 0);

    // Aggregazione per metodo di pagamento (tessere approvate + in attesa + corsi attivi)
    const byMethod = new Map<string, number>();
    for (const m of approvedMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byMethod.set(method, (byMethod.get(method) ?? 0) + m.amountPaidCents);
    }
    for (const m of pendingMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byMethod.set(method, (byMethod.get(method) ?? 0) + m.amountPaidCents);
    }
    for (const c of courses) {
      for (const e of c.enrollments) {
        // Non abbiamo il paymentMethod qui, occorre query separata
      }
    }
    const enrollmentsPaid = await prisma.courseEnrollment.findMany({
      where: {
        courseId: { in: courses.map((c: any) => c.id) },
        status: 'ATTIVA',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      select: { amountPaidCents: true, paymentMethod: true },
    });
    for (const e of enrollmentsPaid) {
      const method = e.paymentMethod || 'SENZA_PAGAMENTO';
      byMethod.set(method, (byMethod.get(method) ?? 0) + e.amountPaidCents);
    }
    const byPaymentMethodArray = Array.from(byMethod.entries()).map(([method, totalCents]) => ({
      method,
      totalCents,
    }));

    // Annullamenti e rifiuti tessere (rimborsi)
    const canceledMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: { in: ['ANNULLATA', 'RIFIUTATA'] },
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
      select: { amountPaidCents: true, paymentMethod: true },
    });

    // Annullamenti corsi (rimborsi)
    const canceledEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        course: { academicYearId: yearId },
        status: 'ANNULLATA',
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
      select: { amountPaidCents: true, paymentMethod: true },
    });

    // Spese (sostenute durante il periodo)
    const expenses = await prisma.expense.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { expenseDate: dateFilter }),
      },
      select: { expenseDate: true, description: true, amountCents: true },
      orderBy: { expenseDate: 'asc' },
    });

    const byMethodRefund = new Map<string, number>();
    for (const m of canceledMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byMethodRefund.set(method, (byMethodRefund.get(method) ?? 0) + m.amountPaidCents);
    }
    for (const e of canceledEnrollments) {
      const method = e.paymentMethod || 'SENZA_PAGAMENTO';
      byMethodRefund.set(method, (byMethodRefund.get(method) ?? 0) + e.amountPaidCents);
    }
    const canceledEnrollmentsArray = Array.from(byMethodRefund.entries()).map(
      ([method, refundCents]) => ({
        method,
        refundCents,
      }),
    );

    const totalExpensesCents = expenses.reduce((acc, e) => acc + e.amountCents, 0);

    const totalMembershipsPaid = [...byCategory.values()].reduce((a: number, b: any) => a + b.paid, 0);
    const totalMembershipsDue = [...byCategory.values()].reduce((a: number, b: any) => a + b.due, 0);
    const totalCoursesPaid = coursesAgg.reduce((a: number, b: any) => a + b.paidCents, 0);
    const totalCoursesDue = coursesAgg.reduce((a: number, b: any) => a + b.dueCents, 0);
    const grandRefundCents =
      canceledMemberships.reduce((acc: number, m: any) => acc + m.amountPaidCents, 0) +
      canceledEnrollments.reduce((acc: number, e: any) => acc + e.amountPaidCents, 0);

    const totalPendingMembershipsPaid = [...pendingByCategory.values()].reduce((a: number, b: any) => a + b.paid, 0);
    const totalPendingMembershipsDue = [...pendingByCategory.values()].reduce((a: number, b: any) => a + b.due, 0);

    res.json({
      academicYear: year ? { id: year.id, label: year.label } : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      memberships: [...byCategory.values()].map((b) => ({
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        count: b.count,
        dueCents: b.due,
        paidCents: b.paid,
      })),
      pendingMemberships: [...pendingByCategory.values()].map((b) => ({
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        count: b.count,
        dueCents: b.due,
        paidCents: b.paid,
      })),
      courses: coursesAgg,
      byPaymentMethod: byPaymentMethodArray,
      canceledEnrollments: canceledEnrollmentsArray,
      expenses: expenses.map((e: typeof expenses[number]) => ({
        expenseDate: e.expenseDate.toISOString().split('T')[0],
        description: e.description,
        amountCents: e.amountCents,
      })),
      totals: {
        membershipsDueCents: totalMembershipsDue,
        membershipsPaidCents: totalMembershipsPaid,
        pendingMembershipsDueCents: totalPendingMembershipsDue,
        pendingMembershipsPaidCents: totalPendingMembershipsPaid,
        coursesDueCents: totalCoursesDue,
        coursesPaidCents: totalCoursesPaid,
        grandPaidCents: totalMembershipsPaid + totalCoursesPaid + totalPendingMembershipsPaid,
        grandDueCents: totalMembershipsDue + totalCoursesDue + totalPendingMembershipsDue,
        grandRefundCents,
        grandExpensesCents: totalExpensesCents,
        grandNetCents: totalMembershipsPaid + totalCoursesPaid + totalPendingMembershipsPaid - grandRefundCents - totalExpensesCents,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/revenue.pdf
router.get('/revenue.pdf', async (req, res, next) => {
  try {
    const { academicYearId, dateFrom, dateTo } = yearQuery.parse(req.query);
    const yearId = await resolveYearId(academicYearId);
    if (!yearId) {
      res.status(400).json({ error: 'Nessun anno accademico disponibile' });
      return;
    }

    const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lt: new Date(new Date(dateTo).getTime() + 86400000) }),
    };

    // Recupera dati identici alla route /revenue
    const approvedMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: 'APPROVATA',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { include: { category: true } } },
    });
    const byCategory = new Map<
      string,
      { categoryId: string; categoryName: string; count: number; due: number; paid: number }
    >();
    for (const m of approvedMemberships) {
      const k = m.member.category.id;
      const cur = byCategory.get(k) ?? {
        categoryId: k,
        categoryName: m.member.category.name,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += m.amountDueCents;
      cur.paid += m.amountPaidCents;
      byCategory.set(k, cur);
    }

    // Tessere IN_ATTESA con pagamento filtreto per data
    const pendingMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: 'IN_ATTESA',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { include: { category: true } } },
    });
    const pendingByCategory = new Map<
      string,
      { categoryId: string; categoryName: string; count: number; due: number; paid: number }
    >();
    for (const m of pendingMemberships) {
      const k = m.member.category.id;
      const cur = pendingByCategory.get(k) ?? {
        categoryId: k,
        categoryName: m.member.category.name,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += m.amountDueCents;
      cur.paid += m.amountPaidCents;
      pendingByCategory.set(k, cur);
    }

    const courses = await prisma.course.findMany({
      where: { academicYearId: yearId },
      include: {
        enrollments: {
          where: {
            status: 'ATTIVA',
            ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
          },
          select: { amountDueCents: true, amountPaidCents: true },
        },
      },
      orderBy: { dataInizio: 'asc' },
    });
    const coursesAgg = courses
      .map((c: any) => {
        const count = c.enrollments.length;
        const due = c.enrollments.reduce((acc: number, e: any) => acc + e.amountDueCents, 0);
        const paid = c.enrollments.reduce((acc: number, e: any) => acc + e.amountPaidCents, 0);
        return {
          courseId: c.id,
          titolo: c.titolo,
          status: c.status,
          count,
          dueCents: due,
          paidCents: paid,
        };
      })
      .filter((c: any) => c.count > 0);

    const canceledMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: { in: ['ANNULLATA', 'RIFIUTATA'] },
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
      select: { amountPaidCents: true, paymentMethod: true },
    });

    const canceledEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        course: { academicYearId: yearId },
        status: 'ANNULLATA',
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
      select: { amountPaidCents: true, paymentMethod: true },
    });

    // Aggregazione per metodo di pagamento (tessere approvate + in attesa + corsi attivi)
    const byMethod = new Map<string, number>();
    for (const m of approvedMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byMethod.set(method, (byMethod.get(method) ?? 0) + m.amountPaidCents);
    }
    for (const m of pendingMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byMethod.set(method, (byMethod.get(method) ?? 0) + m.amountPaidCents);
    }
    const enrollmentsPaidPDF = await prisma.courseEnrollment.findMany({
      where: {
        courseId: { in: courses.map((c: any) => c.id) },
        status: 'ATTIVA',
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      select: { amountPaidCents: true, paymentMethod: true },
    });
    for (const e of enrollmentsPaidPDF) {
      const method = e.paymentMethod || 'SENZA_PAGAMENTO';
      byMethod.set(method, (byMethod.get(method) ?? 0) + e.amountPaidCents);
    }
    const byPaymentMethodArray = Array.from(byMethod.entries()).map(([method, totalCents]) => ({
      method,
      totalCents,
    }));

    const totalMembershipsPaid = [...byCategory.values()].reduce((a: number, b: any) => a + b.paid, 0);
    const totalMembershipsDue = [...byCategory.values()].reduce((a: number, b: any) => a + b.due, 0);
    const totalPendingMembershipsPaid = [...pendingByCategory.values()].reduce((a: number, b: any) => a + b.paid, 0);
    const totalPendingMembershipsDue = [...pendingByCategory.values()].reduce((a: number, b: any) => a + b.due, 0);
    const totalCoursesPaid = coursesAgg.reduce((a: number, b: any) => a + b.paidCents, 0);
    const totalCoursesDue = coursesAgg.reduce((a: number, b: any) => a + b.dueCents, 0);
    const grandRefundCents =
      canceledMemberships.reduce((acc: number, m: any) => acc + m.amountPaidCents, 0) +
      canceledEnrollments.reduce((acc: number, e: any) => acc + e.amountPaidCents, 0);

    const byMethodRefund = new Map<string, number>();
    for (const m of canceledMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byMethodRefund.set(method, (byMethodRefund.get(method) ?? 0) + m.amountPaidCents);
    }
    for (const e of canceledEnrollments) {
      const method = e.paymentMethod || 'SENZA_PAGAMENTO';
      byMethodRefund.set(method, (byMethodRefund.get(method) ?? 0) + e.amountPaidCents);
    }
    const canceledEnrollmentsArray = Array.from(byMethodRefund.entries()).map(
      ([method, refundCents]) => ({
        method,
        refundCents,
      }),
    );

    // Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: Object.keys(dateFilter).length > 0 ? { expenseDate: dateFilter } : undefined,
      select: { expenseDate: true, description: true, amountCents: true },
      orderBy: { expenseDate: 'desc' },
    });

    const pdfBuffer = await generateRevenueReportPDF({
      academicYearLabel: year?.label ?? '?',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      memberships: [...byCategory.values()].map((b) => ({
        categoryName: b.categoryName,
        count: b.count,
        dueCents: b.due,
        paidCents: b.paid,
      })),
      pendingMemberships: [...pendingByCategory.values()].map((b) => ({
        categoryName: b.categoryName,
        count: b.count,
        dueCents: b.due,
        paidCents: b.paid,
      })),
      courses: coursesAgg,
      byPaymentMethod: byPaymentMethodArray,
      canceledEnrollments: canceledEnrollmentsArray,
      expenses: expenses.map((e: typeof expenses[number]) => ({
        expenseDate: e.expenseDate.toISOString(),
        description: e.description,
        amountCents: e.amountCents,
      })),
      totals: {
        membershipsDueCents: totalMembershipsDue,
        membershipsPaidCents: totalMembershipsPaid,
        pendingMembershipsDueCents: totalPendingMembershipsDue,
        pendingMembershipsPaidCents: totalPendingMembershipsPaid,
        coursesDueCents: totalCoursesDue,
        coursesPaidCents: totalCoursesPaid,
        grandPaidCents: totalMembershipsPaid + totalCoursesPaid + totalPendingMembershipsPaid,
        grandDueCents: totalMembershipsDue + totalCoursesDue + totalPendingMembershipsDue,
        grandRefundCents,
        grandNetCents: totalMembershipsPaid + totalCoursesPaid + totalPendingMembershipsPaid - grandRefundCents,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Riepilogo-Incassi-${year?.label ?? 'report'}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/enrollments-detail - Report dettagliato iscrizioni e corsi
router.get('/enrollments-detail', async (req, res, next) => {
  try {
    const { academicYearId, dateFrom, dateTo } = yearQuery.parse(req.query);
    const yearId = await resolveYearId(academicYearId);
    const pageSize = 50;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);

    if (!yearId) {
      res.json({
        academicYear: null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        memberships: [],
        membershipsSummary: [],
        membershipsPagination: { page, pageSize, total: 0 },
        courseEnrollments: [],
        courseEnrollmentsSummary: [],
        courseEnrollmentsPagination: { page, pageSize, total: 0 },
        byPaymentMethod: [],
        canceledEnrollments: [],
        expenses: [],
        totals: {
          membershipsDueCents: 0,
          membershipsPaidCents: 0,
          courseEnrollmentsDueCents: 0,
          courseEnrollmentsPaidCents: 0,
          grandPaidCents: 0,
        },
      });
      return;
    }

    const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lt: new Date(new Date(dateTo).getTime() + 86400000) }),
    };

    // Sezione 1: Iscrizioni tessere (memberships)
    const totalMemberships = await prisma.membership.count({
      where: {
        academicYearId: yearId,
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
    });

    const memberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { select: { id: true, cognome: true, nome: true } } },
      orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Sommario memberships raggruppato per tipo + stato + metodo
    const membershipsSummaryMap = new Map<
      string,
      { type: string; status: string; method: string | null; count: number; due: number; paid: number }
    >();

    const allMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
    });

    for (const m of allMemberships) {
      const key = `${m.type}|${m.status}|${m.paymentMethod || 'null'}`;
      const cur = membershipsSummaryMap.get(key) ?? {
        type: m.type,
        status: m.status,
        method: m.paymentMethod,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += m.amountDueCents;
      cur.paid += m.amountPaidCents;
      membershipsSummaryMap.set(key, cur);
    }

    const membershipsSummary = Array.from(membershipsSummaryMap.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return (a.method || '').localeCompare(b.method || '');
    });

    // Sezione 2: Iscrizioni ai corsi
    const totalCourseEnrollments = await prisma.courseEnrollment.count({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
    });

    const courseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: {
        member: { select: { id: true, cognome: true, nome: true } },
        course: { select: { id: true, titolo: true, academicYearId: true } },
      },
      orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Filtra solo per anno accademico
    const courseEnrollmentsFiltered = courseEnrollments.filter(
      (e: any) => e.course.academicYearId === yearId,
    );

    // Sommario course enrollments raggruppato per status + metodo
    const courseEnrollmentsSummaryMap = new Map<
      string,
      { status: string; method: string | null; count: number; due: number; paid: number }
    >();

    const allCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { course: { select: { academicYearId: true } } },
    });

    for (const e of allCourseEnrollments) {
      if (e.course.academicYearId !== yearId) continue;
      const key = `${e.status}|${e.paymentMethod || 'null'}`;
      const cur = courseEnrollmentsSummaryMap.get(key) ?? {
        status: e.status,
        method: e.paymentMethod,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += e.amountDueCents;
      cur.paid += e.amountPaidCents;
      courseEnrollmentsSummaryMap.set(key, cur);
    }

    const courseEnrollmentsSummary = Array.from(courseEnrollmentsSummaryMap.values()).sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return (a.method || '').localeCompare(b.method || '');
    });

    // Sezione 3: Incassi per metodo di pagamento e rimborsi
    const byPaymentMethodMap = new Map<string, number>();
    const byRefundMethodMap = new Map<string, number>();

    for (const m of allMemberships) {
      if (m.amountPaidCents > 0) {
        const method = m.paymentMethod || 'SENZA_PAGAMENTO';
        byPaymentMethodMap.set(method, (byPaymentMethodMap.get(method) ?? 0) + m.amountPaidCents);
      }
    }

    for (const e of allCourseEnrollments) {
      if (e.course.academicYearId !== yearId) continue;
      if (e.amountPaidCents > 0) {
        const method = e.paymentMethod || 'SENZA_PAGAMENTO';
        byPaymentMethodMap.set(method, (byPaymentMethodMap.get(method) ?? 0) + e.amountPaidCents);
      }
    }

    // Rimborsi (iscrizioni annullate con pagamento)
    const canceledMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: { in: ['ANNULLATA', 'RIFIUTATA'] },
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
    });

    const canceledCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        status: 'ANNULLATA',
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
      include: { course: { select: { academicYearId: true } } },
    });

    for (const m of canceledMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byRefundMethodMap.set(method, (byRefundMethodMap.get(method) ?? 0) + m.amountPaidCents);
    }

    for (const e of canceledCourseEnrollments) {
      if (e.course.academicYearId !== yearId) continue;
      const method = e.paymentMethod || 'SENZA_PAGAMENTO';
      byRefundMethodMap.set(method, (byRefundMethodMap.get(method) ?? 0) + e.amountPaidCents);
    }

    const byPaymentMethod = Array.from(byPaymentMethodMap.entries()).map(([method, totalCents]) => ({
      method,
      totalCents,
    }));

    const canceledEnrollments = Array.from(byRefundMethodMap.entries()).map(
      ([method, refundCents]) => ({
        method,
        refundCents,
      }),
    );

    // Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: Object.keys(dateFilter).length > 0 ? { expenseDate: dateFilter } : undefined,
      select: { expenseDate: true, description: true, amountCents: true },
      orderBy: { expenseDate: 'desc' },
    });

    // Calcolo totali
    const totalMembershipsDue = allMemberships.reduce((a: number, m: any) => a + m.amountDueCents, 0);
    const totalMembershipsPaid = allMemberships.reduce((a: number, m: any) => a + m.amountPaidCents, 0);
    const totalCourseEnrollmentsDue = allCourseEnrollments
      .filter((e: any) => e.course.academicYearId === yearId)
      .reduce((a: number, e: any) => a + e.amountDueCents, 0);
    const totalCourseEnrollmentsPaid = allCourseEnrollments
      .filter((e: any) => e.course.academicYearId === yearId)
      .reduce((a: number, e: any) => a + e.amountPaidCents, 0);

    res.json({
      academicYear: year ? { id: year.id, label: year.label } : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,

      memberships: memberships.map((m: any) => ({
        member: m.member,
        createdAt: m.paymentDate?.toISOString() || m.createdAt.toISOString(),
        type: m.type,
        status: m.status,
        amountDueCents: m.amountDueCents,
        amountPaidCents: m.amountPaidCents,
        paymentMethod: m.paymentMethod,
      })),

      membershipsSummary: Array.from(membershipsSummaryMap.values())
        .sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type);
          if (a.status !== b.status) return a.status.localeCompare(b.status);
          return (a.method || '').localeCompare(b.method || '');
        })
        .map((s) => ({
          type: s.type,
          status: s.status,
          paymentMethod: s.method,
          count: s.count,
          totalDueCents: s.due,
          totalPaidCents: s.paid,
        })),
      membershipsPagination: { page, pageSize, total: totalMemberships },

      courseEnrollments: courseEnrollmentsFiltered.map((e) => ({
        member: e.member,
        course: e.course,
        createdAt: e.createdAt.toISOString(),
        status: e.status,
        amountDueCents: e.amountDueCents,
        amountPaidCents: e.amountPaidCents,
        paymentMethod: e.paymentMethod,
      })),

      courseEnrollmentsSummary: Array.from(courseEnrollmentsSummaryMap.values())
        .sort((a, b) => {
          if (a.status !== b.status) return a.status.localeCompare(b.status);
          return (a.method || '').localeCompare(b.method || '');
        })
        .map((s) => ({
          status: s.status,
          paymentMethod: s.method,
          count: s.count,
          totalDueCents: s.due,
          totalPaidCents: s.paid,
        })),
      courseEnrollmentsPagination: { page, pageSize, total: totalCourseEnrollments },

      byPaymentMethod,
      canceledEnrollments,
      expenses: expenses.map((e: typeof expenses[number]) => ({
        expenseDate: e.expenseDate.toISOString(),
        description: e.description,
        amountCents: e.amountCents,
      })),

      totals: {
        membershipsDueCents: totalMembershipsDue,
        membershipsPaidCents: totalMembershipsPaid,
        courseEnrollmentsDueCents: totalCourseEnrollmentsDue,
        courseEnrollmentsPaidCents: totalCourseEnrollmentsPaid,
        grandPaidCents: totalMembershipsPaid + totalCourseEnrollmentsPaid,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/enrollments-detail.pdf
router.get('/enrollments-detail.pdf', async (req, res, next) => {
  try {
    const { academicYearId, dateFrom, dateTo } = yearQuery.parse(req.query);
    const yearId = await resolveYearId(academicYearId);
    if (!yearId) {
      res.status(400).json({ error: 'Nessun anno accademico disponibile' });
      return;
    }

    const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lt: new Date(new Date(dateTo).getTime() + 86400000) }),
    };

    // Fetch all memberships
    const allMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { select: { id: true, cognome: true, nome: true } } },
      orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
    });

    // Sommario memberships
    const membershipsSummaryMap = new Map<
      string,
      { type: string; status: string; method: string | null; count: number; due: number; paid: number }
    >();
    for (const m of allMemberships) {
      const key = `${m.type}|${m.status}|${m.paymentMethod || 'null'}`;
      const cur = membershipsSummaryMap.get(key) ?? {
        type: m.type,
        status: m.status,
        method: m.paymentMethod,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += m.amountDueCents;
      cur.paid += m.amountPaidCents;
      membershipsSummaryMap.set(key, cur);
    }

    // Fetch all course enrollments
    const allCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: {
        member: { select: { id: true, cognome: true, nome: true } },
        course: { select: { id: true, titolo: true, academicYearId: true } },
      },
      orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
    });

    const courseEnrollmentsFiltered = allCourseEnrollments.filter(
      (e) => e.course.academicYearId === yearId,
    );

    // Sommario course enrollments
    const courseEnrollmentsSummaryMap = new Map<
      string,
      { status: string; method: string | null; count: number; due: number; paid: number }
    >();
    for (const e of courseEnrollmentsFiltered) {
      const key = `${e.status}|${e.paymentMethod || 'null'}`;
      const cur = courseEnrollmentsSummaryMap.get(key) ?? {
        status: e.status,
        method: e.paymentMethod,
        count: 0,
        due: 0,
        paid: 0,
      };
      cur.count += 1;
      cur.due += e.amountDueCents;
      cur.paid += e.amountPaidCents;
      courseEnrollmentsSummaryMap.set(key, cur);
    }

    // Payment methods and refunds
    const byPaymentMethodMap = new Map<string, number>();
    const byRefundMethodMap = new Map<string, number>();

    for (const m of allMemberships) {
      if (m.amountPaidCents > 0) {
        const method = m.paymentMethod || 'SENZA_PAGAMENTO';
        byPaymentMethodMap.set(method, (byPaymentMethodMap.get(method) ?? 0) + m.amountPaidCents);
      }
    }

    for (const e of courseEnrollmentsFiltered) {
      if (e.amountPaidCents > 0) {
        const method = e.paymentMethod || 'SENZA_PAGAMENTO';
        byPaymentMethodMap.set(method, (byPaymentMethodMap.get(method) ?? 0) + e.amountPaidCents);
      }
    }

    // Canceled
    const canceledMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: { in: ['ANNULLATA', 'RIFIUTATA'] },
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
    });

    const canceledCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        status: 'ANNULLATA',
        amountPaidCents: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 && { updatedAt: dateFilter }),
      },
      include: { course: { select: { academicYearId: true } } },
    });

    for (const m of canceledMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byRefundMethodMap.set(method, (byRefundMethodMap.get(method) ?? 0) + m.amountPaidCents);
    }

    for (const e of canceledCourseEnrollments) {
      if (e.course.academicYearId === yearId) {
        const method = e.paymentMethod || 'SENZA_PAGAMENTO';
        byRefundMethodMap.set(method, (byRefundMethodMap.get(method) ?? 0) + e.amountPaidCents);
      }
    }

    const byPaymentMethod = Array.from(byPaymentMethodMap.entries()).map(([method, totalCents]) => ({
      method,
      totalCents,
    }));

    const canceledEnrollments = Array.from(byRefundMethodMap.entries()).map(
      ([method, refundCents]) => ({
        method,
        refundCents,
      }),
    );

    // Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: Object.keys(dateFilter).length > 0 ? { expenseDate: dateFilter } : undefined,
      select: { expenseDate: true, description: true, amountCents: true },
      orderBy: { expenseDate: 'desc' },
    });

    // Totals
    const totalMembershipsDue = allMemberships.reduce((a: number, m: any) => a + m.amountDueCents, 0);
    const totalMembershipsPaid = allMemberships.reduce((a: number, m: any) => a + m.amountPaidCents, 0);
    const totalCourseEnrollmentsDue = courseEnrollmentsFiltered.reduce(
      (a, e) => a + e.amountDueCents,
      0,
    );
    const totalCourseEnrollmentsPaid = courseEnrollmentsFiltered.reduce(
      (a, e) => a + e.amountPaidCents,
      0,
    );

    const pdfBuffer = await generateEnrollmentsDetailPDF({
      academicYearLabel: year?.label ?? '?',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      memberships: allMemberships.map((m) => ({
        member: m.member,
        type: m.type,
        status: m.status,
        amountDueCents: m.amountDueCents,
        amountPaidCents: m.amountPaidCents,
        paymentMethod: m.paymentMethod,
        receiptNumber: m.receiptNumber,
        createdAt: m.createdAt.toISOString(),
      })),
      membershipsSummary: Array.from(membershipsSummaryMap.values())
        .sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type);
          if (a.status !== b.status) return a.status.localeCompare(b.status);
          return (a.method || '').localeCompare(b.method || '');
        })
        .map((s) => ({
          type: s.type,
          status: s.status,
          paymentMethod: s.method,
          count: s.count,
          totalDueCents: s.due,
          totalPaidCents: s.paid,
        })),
      courseEnrollments: courseEnrollmentsFiltered.map((e) => ({
        member: e.member,
        course: e.course,
        status: e.status,
        amountDueCents: e.amountDueCents,
        amountPaidCents: e.amountPaidCents,
        paymentMethod: e.paymentMethod,
        receiptNumber: e.receiptNumber,
        createdAt: e.createdAt.toISOString(),
      })),
      courseEnrollmentsSummary: Array.from(courseEnrollmentsSummaryMap.values())
        .sort((a, b) => {
          if (a.status !== b.status) return a.status.localeCompare(b.status);
          return (a.method || '').localeCompare(b.method || '');
        })
        .map((s) => ({
          status: s.status,
          paymentMethod: s.method,
          count: s.count,
          totalDueCents: s.due,
          totalPaidCents: s.paid,
        })),
      byPaymentMethod,
      canceledEnrollments,
      expenses: expenses.map((e: typeof expenses[number]) => ({
        expenseDate: e.expenseDate.toISOString(),
        description: e.description,
        amountCents: e.amountCents,
      })),
      totals: {
        membershipsDueCents: totalMembershipsDue,
        membershipsPaidCents: totalMembershipsPaid,
        courseEnrollmentsDueCents: totalCourseEnrollmentsDue,
        courseEnrollmentsPaidCents: totalCourseEnrollmentsPaid,
        grandPaidCents: totalMembershipsPaid + totalCourseEnrollmentsPaid,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Dettaglio-Iscrizioni-${year?.label ?? 'report'}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/enrollments-detail.xlsx
router.get('/enrollments-detail.xlsx', async (req, res, next) => {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const { academicYearId, dateFrom, dateTo } = yearQuery.parse(req.query);
    const yearId = await resolveYearId(academicYearId);
    if (!yearId) {
      res.status(400).json({ error: 'Nessun anno accademico disponibile' });
      return;
    }

    const year = await prisma.academicYear.findUnique({ where: { id: yearId } });
    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lt: new Date(new Date(dateTo).getTime() + 86400000) }),
    };

    // Fetch data
    const allMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: { member: { select: { id: true, cognome: true, nome: true } } },
      orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
    });

    const allCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
      },
      include: {
        member: { select: { id: true, cognome: true, nome: true } },
        course: { select: { id: true, titolo: true, academicYearId: true } },
      },
      orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
    });

    const courseEnrollmentsFiltered = allCourseEnrollments.filter(
      (e) => e.course.academicYearId === yearId,
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Tessere
    const sheetTessere = workbook.addWorksheet('Tessere');
    sheetTessere.columns = [
      { header: 'Cognome', key: 'cognome', width: 18 },
      { header: 'Nome', key: 'nome', width: 18 },
      { header: 'Data Iscrizione', key: 'createdAt', width: 15 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Dovuto', key: 'due', width: 12 },
      { header: 'Pagato', key: 'paid', width: 12 },
      { header: 'Numero Blocco / Ricevuta', key: 'receiptNumber', width: 22 },
      { header: 'Metodo', key: 'method', width: 15 },
    ];
    sheetTessere.getRow(1).font = { bold: true };

    for (const m of allMemberships) {
      sheetTessere.addRow({
        cognome: m.member.cognome,
        nome: m.member.nome,
        createdAt: new Date(m.createdAt).toLocaleDateString('it-IT'),
        type: m.type,
        status: m.status,
        due: m.amountDueCents / 100,
        paid: m.amountPaidCents / 100,
        receiptNumber: m.receiptNumber || '',
        method: m.paymentMethod || '-',
      });
    }

    // Sheet 2: Corsi
    const sheetCorsi = workbook.addWorksheet('Corsi');
    sheetCorsi.columns = [
      { header: 'Cognome', key: 'cognome', width: 18 },
      { header: 'Nome', key: 'nome', width: 18 },
      { header: 'Data Iscrizione', key: 'createdAt', width: 15 },
      { header: 'Corso', key: 'corso', width: 30 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Dovuto', key: 'due', width: 12 },
      { header: 'Pagato', key: 'paid', width: 12 },
      { header: 'Numero Blocco / Ricevuta', key: 'receiptNumber', width: 22 },
      { header: 'Metodo', key: 'method', width: 15 },
    ];
    sheetCorsi.getRow(1).font = { bold: true };

    for (const e of courseEnrollmentsFiltered) {
      sheetCorsi.addRow({
        cognome: e.member.cognome,
        nome: e.member.nome,
        createdAt: new Date(e.createdAt).toLocaleDateString('it-IT'),
        corso: e.course.titolo,
        status: e.status,
        due: e.amountDueCents / 100,
        paid: e.amountPaidCents / 100,
        receiptNumber: e.receiptNumber || '',
        method: e.paymentMethod || '-',
      });
    }

    // Sheet 3: Riepilogo Incassi
    const sheetRiepilogo = workbook.addWorksheet('Riepilogo Incassi');
    sheetRiepilogo.columns = [
      { header: 'Metodo', key: 'method', width: 20 },
      { header: 'Importo', key: 'amount', width: 15 },
    ];
    sheetRiepilogo.getRow(1).font = { bold: true };

    const byPaymentMethodMap = new Map<string, number>();
    for (const m of allMemberships) {
      if (m.amountPaidCents > 0) {
        const method = m.paymentMethod || 'SENZA_PAGAMENTO';
        byPaymentMethodMap.set(method, (byPaymentMethodMap.get(method) ?? 0) + m.amountPaidCents);
      }
    }
    for (const e of courseEnrollmentsFiltered) {
      if (e.amountPaidCents > 0) {
        const method = e.paymentMethod || 'SENZA_PAGAMENTO';
        byPaymentMethodMap.set(method, (byPaymentMethodMap.get(method) ?? 0) + e.amountPaidCents);
      }
    }

    sheetRiepilogo.addRow({ method: 'INCASSI PER METODO', amount: '' });
    for (const [method, cents] of byPaymentMethodMap.entries()) {
      sheetRiepilogo.addRow({ method, amount: cents / 100 });
    }

    // Rimborsi
    const byRefundMethodMap = new Map<string, number>();
    const canceledMemberships = await prisma.membership.findMany({
      where: {
        academicYearId: yearId,
        status: { in: ['ANNULLATA', 'RIFIUTATA'] },
        amountPaidCents: { gt: 0 },
      },
    });

    const canceledCourseEnrollments = await prisma.courseEnrollment.findMany({
      where: {
        status: 'ANNULLATA',
        amountPaidCents: { gt: 0 },
      },
      include: { course: { select: { academicYearId: true } } },
    });

    for (const m of canceledMemberships) {
      const method = m.paymentMethod || 'SENZA_PAGAMENTO';
      byRefundMethodMap.set(method, (byRefundMethodMap.get(method) ?? 0) + m.amountPaidCents);
    }

    for (const e of canceledCourseEnrollments) {
      if (e.course.academicYearId === yearId) {
        const method = e.paymentMethod || 'SENZA_PAGAMENTO';
        byRefundMethodMap.set(method, (byRefundMethodMap.get(method) ?? 0) + e.amountPaidCents);
      }
    }

    sheetRiepilogo.addRow({ method: '', amount: '' });
    sheetRiepilogo.addRow({ method: 'ANNULLAMENTI (RIMBORSI)', amount: '' });
    for (const [method, cents] of byRefundMethodMap.entries()) {
      sheetRiepilogo.addRow({ method, amount: -cents / 100 });
    }

    // Format currency
    sheetTessere.getColumn('F').numFmt = '#,##0.00';
    sheetTessere.getColumn('G').numFmt = '#,##0.00';
    sheetCorsi.getColumn('F').numFmt = '#,##0.00';
    sheetCorsi.getColumn('G').numFmt = '#,##0.00';
    sheetRiepilogo.getColumn('B').numFmt = '#,##0.00';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Dettaglio-Iscrizioni-${year?.label ?? 'report'}.xlsx"`,
    );
    res.send(await workbook.xlsx.writeBuffer());
  } catch (err) {
    next(err);
  }
});

export default router;

