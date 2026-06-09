import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/stats/overview  — conteggi per dashboard
router.get('/overview', async (_req, res, next) => {
  try {
    const currentYear = await prisma.academicYear.findFirst({ where: { active: true } });
    const [
      totalMembers,
      pendingMemberships,
      activeCourses,
      newMemberships,
      renewalMemberships,
      totalCourseParticipants,
    ] = await Promise.all([
      prisma.member.count(),
      currentYear
        ? prisma.membership.count({
            where: { academicYearId: currentYear.id, status: 'IN_ATTESA' },
          })
        : Promise.resolve(0),
      currentYear
        ? prisma.course.count({
            where: { academicYearId: currentYear.id, status: { in: ['APERTO', 'IN_PREPARAZIONE'] } },
          })
        : Promise.resolve(0),
      currentYear
        ? prisma.membership.count({
            where: { academicYearId: currentYear.id, type: 'NUOVA' },
          })
        : Promise.resolve(0),
      currentYear
        ? prisma.membership.count({
            where: { academicYearId: currentYear.id, type: 'RINNOVO' },
          })
        : Promise.resolve(0),
      currentYear
        ? prisma.courseEnrollment.count({
            where: {
              status: 'ATTIVA',
              course: { academicYearId: currentYear.id, status: { in: ['APERTO', 'IN_PREPARAZIONE'] } },
            },
          })
        : Promise.resolve(0),
    ]);
    res.json({
      currentYear: currentYear ? { id: currentYear.id, label: currentYear.label } : null,
      totalMembers,
      pendingMemberships,
      activeCourses,
      newMemberships,
      renewalMemberships,
      totalCourseParticipants,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/memberships-timeline — dati temporali iscrizioni per grafico
router.get('/memberships-timeline', async (_req, res, next) => {
  try {
    const currentYear = await prisma.academicYear.findFirst({ where: { active: true } });
    if (!currentYear) {
      res.json([]);
      return;
    }

    // Fetch all memberships for current year with their payment dates
    const memberships = await prisma.membership.findMany({
      where: { academicYearId: currentYear.id },
      select: { paymentDate: true, type: true },
      orderBy: { paymentDate: 'asc' },
    });

    if (memberships.length === 0) {
      res.json([]);
      return;
    }

    // Build timeline by date with daily (non-cumulative) counts
    const dateMap = new Map<string, { nuova: number; rinnovo: number }>();

    for (const m of memberships) {
      if (!m.paymentDate) continue;
      const dateStr = m.paymentDate.toISOString().split('T')[0];

      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { nuova: 0, rinnovo: 0 });
      }

      const current = dateMap.get(dateStr)!;
      if (m.type === 'NUOVA') current.nuova++;
      else if (m.type === 'RINNOVO') current.rinnovo++;
    }

    // Convert to array format for chart (only dates with data)
    const timeline = Array.from(dateMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, counts]) => ({
        date,
        nuova: counts.nuova,
        rinnovo: counts.rinnovo,
        totale: counts.nuova + counts.rinnovo,
      }));

    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

export default router;

