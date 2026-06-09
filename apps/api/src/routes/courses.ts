import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import ExcelJS from 'exceljs';
// @ts-expect-error busboy has no types
import Busboy from 'busboy';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';
import { courseStatusSchema } from '../types/enums.js';
import { formatItDate, toCsv } from '../lib/csv.js';
import { generateAttendanceSheet, generateEnrollmentsList } from '../lib/pdf-attendance.js';

const router = Router();
router.use(requireAuth);

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Data non valida');

const createSchema = z.object({
  academicYearId: z.string().min(1),
  codice: z.string().trim().max(40).optional(),
  titolo: z.string().trim().min(1).max(160),
  descrizione: z.string().trim().max(2000).optional(),
  docente: z.string().trim().max(120).optional(),
  costoCents: z.number().int().nonnegative(),
  dataInizio: isoDate,
  numeroSessioni: z.number().int().positive(),
  postiMassimi: z.number().int().positive().optional().nullable(),
  sede: z.string().trim().max(160).optional(),
  status: courseStatusSchema.optional(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  academicYearId: z.string().optional(),
  status: courseStatusSchema.optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  sortBy: z.enum(['titolo', 'year', 'dataInizio', 'status']).default('titolo'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// POST /api/courses/import
router.post('/import', async (req, res, next) => {
  try {
    const bb = Busboy({ headers: req.headers });
    let fileBuffer: Buffer | null = null;

    bb.on('file', async (fieldname: string, file: any) => {
      const chunks: Buffer[] = [];
      file.on('data', (data: Buffer) => chunks.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('close', async () => {
      if (!fileBuffer) {
        res.status(400).json({ error: 'Nessun file caricato' });
        return;
      }

      try {
        const workbook = new ExcelJS.Workbook();
        // @ts-expect-error ExcelJS types incompatibility with Node.js
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
          res.status(400).json({ error: 'Foglio Excel non trovato' });
          return;
        }

        const results = { created: 0, updated: 0, errors: [] as string[] };

        // Leggi ogni riga (skip header)
        for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          if (!row.values || row.values.length === 0) continue;

          try {
            const values = row.values as any[];
            const annoAccademico = values[1];
            const titolo = values[2];
            const docente = values[3];
            const datainizio = values[4];
            const numerosessioni = values[5];
            const costo = values[6];

            if (!annoAccademico || !titolo) {
              results.errors.push(`Riga ${rowNum}: AnnoAccademico e titolo obbligatori`);
              continue;
            }

            if (!datainizio || !numerosessioni) {
              results.errors.push(`Riga ${rowNum}: data inizio e numero sessioni obbligatori`);
              continue;
            }

            // Risolvi l'ID dell'anno accademico dal label
            const academicYear = await prisma.academicYear.findUnique({
              where: { label: String(annoAccademico).trim() },
            });

            if (!academicYear) {
              results.errors.push(`Riga ${rowNum}: Anno accademico "${annoAccademico}" non trovato`);
              continue;
            }

            const costoCents = costo ? Math.round(parseFloat(String(costo).replace(',', '.')) * 100) : 0;

            const data: Prisma.CourseCreateInput = {
              academicYear: { connect: { id: academicYear.id } },
              titolo: String(titolo).trim(),
              docente: docente ? String(docente).trim() : null,
              dataInizio: datainizio instanceof Date ? datainizio : new Date(String(datainizio)),
              numeroSessioni: parseInt(String(numerosessioni), 10),
              costoCents,
              status: 'APERTO',
            };

            const existing = await prisma.course.findFirst({
              where: {
                academicYearId: academicYear.id,
                titolo: String(titolo).trim(),
              },
            });

            if (existing) {
              await prisma.course.update({
                where: { id: existing.id },
                data: {
                  docente: data.docente,
                  dataInizio: data.dataInizio,
                  numeroSessioni: data.numeroSessioni,
                  costoCents: data.costoCents,
                },
              });
              results.updated++;
            } else {
              await prisma.course.create({ data });
              results.created++;
            }
          } catch (err) {
            results.errors.push(`Riga ${rowNum}: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
          }
        }

        await audit({
          userId: req.user!.userId,
          action: 'COURSES_IMPORTED',
          entityType: 'Course',
          entityId: 'bulk',
          payload: results,
        });

        res.json({ success: true, ...results, total: results.created + results.updated });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Errore durante import' });
      }
    });

    req.pipe(bb);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses
router.get('/', async (req, res, next) => {
  try {
    const f = listQuerySchema.parse(req.query);
    const where: Prisma.CourseWhereInput = {};
    if (f.academicYearId) where.academicYearId = f.academicYearId;
    if (f.status) where.status = f.status;
    if (f.q) {
      where.OR = [
        { titolo: { contains: f.q, mode: 'insensitive' } },
        { codice: { contains: f.q, mode: 'insensitive' } },
        { docente: { contains: f.q, mode: 'insensitive' } },
      ];
    }
    const orderBy: Prisma.CourseOrderByWithRelationInput[] = [];
    if (f.sortBy === 'year') {
      orderBy.push({ academicYear: { label: f.sortOrder } });
    } else if (f.sortBy === 'dataInizio') {
      orderBy.push({ dataInizio: f.sortOrder });
    } else if (f.sortBy === 'status') {
      orderBy.push({ status: f.sortOrder });
    } else {
      orderBy.push({ titolo: f.sortOrder });
    }
    orderBy.push({ titolo: 'asc' });

    const [total, items] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy,
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: {
          academicYear: { select: { id: true, label: true } },
          _count: { select: { enrollments: { where: { status: 'ATTIVA' } } } },
        },
      }),
    ]);
    res.json({
      total,
      page: f.page,
      pageSize: f.pageSize,
      items: items.map((c: any) => ({
        ...c,
        iscrittiAttivi: c._count.enrollments,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        academicYear: true,
        enrollments: {
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          include: {
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
        },
      },
    });
    if (!course) {
      res.status(404).json({ error: 'Corso non trovato' });
      return;
    }
    res.json({ course });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.course.create({
      data: {
        academicYearId: data.academicYearId,
        codice: data.codice,
        titolo: data.titolo,
        descrizione: data.descrizione,
        docente: data.docente,
        costoCents: data.costoCents,
        dataInizio: new Date(data.dataInizio),
        numeroSessioni: data.numeroSessioni,
        postiMassimi: data.postiMassimi ?? null,
        sede: data.sede,
        status: data.status ?? 'IN_PREPARAZIONE',
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: created.id,
      payload: { titolo: created.titolo },
    });
    res.status(201).json({ course: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/courses/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
        ...(data.codice !== undefined ? { codice: data.codice } : {}),
        ...(data.titolo !== undefined ? { titolo: data.titolo } : {}),
        ...(data.descrizione !== undefined ? { descrizione: data.descrizione } : {}),
        ...(data.docente !== undefined ? { docente: data.docente } : {}),
        ...(data.costoCents !== undefined ? { costoCents: data.costoCents } : {}),
        ...(data.dataInizio !== undefined ? { dataInizio: new Date(data.dataInizio) } : {}),
        ...(data.numeroSessioni !== undefined ? { numeroSessioni: data.numeroSessioni } : {}),
        ...(data.postiMassimi !== undefined ? { postiMassimi: data.postiMassimi } : {}),
        ...(data.sede !== undefined ? { sede: data.sede } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_UPDATED',
      entityType: 'Course',
      entityId: updated.id,
      payload: Object.keys(data),
    });
    res.json({ course: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// GET /api/courses/:id/enrollments.csv
router.get('/:id/enrollments.csv', async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: { academicYear: { select: { label: true } } },
    });
    if (!course) {
      res.status(404).json({ error: 'Corso non trovato' });
      return;
    }
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId: course.id },
      orderBy: [{ status: 'asc' }, { member: { cognome: 'asc' } }],
      include: {
        member: {
          select: {
            cognome: true,
            nome: true,
            codiceFiscale: true,
            email: true,
            telefono: true,
            cellulare: true,
            category: { select: { name: true } },
          },
        },
      },
    });
    const headers = [
      'Cognome',
      'Nome',
      'Codice fiscale',
      'Categoria',
      'Stato',
      'Dovuto',
      'Pagato',
      'Data pagamento',
      'Metodo',
      'Email',
      'Telefono',
      'Cellulare',
    ];
    const rows = enrollments.map((e: any) => [
      e.member.cognome,
      e.member.nome,
      e.member.codiceFiscale ?? '',
      e.member.category.name,
      e.status,
      (e.amountDueCents / 100).toFixed(2).replace('.', ','),
      (e.amountPaidCents / 100).toFixed(2).replace('.', ','),
      formatItDate(e.paymentDate),
      e.paymentMethod ?? '',
      e.member.email ?? '',
      e.member.telefono ?? '',
      e.member.cellulare ?? '',
    ]);
    const filename = `iscritti_${course.titolo.replace(/[^a-zA-Z0-9]+/g, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(toCsv(headers, rows));
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id/attendance.pdf  — foglio firme di presenza per il corso
router.get('/:id/attendance.pdf', async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        enrollments: {
          where: { status: 'ATTIVA' },
          include: {
            member: {
              select: { cognome: true, nome: true, telefono: true, cellulare: true },
            },
          },
          orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
        },
      },
    });
    if (!course) {
      res.status(404).json({ error: 'Corso non trovato' });
      return;
    }
    const bytes = await generateAttendanceSheet(
      { codice: course.codice, titolo: course.titolo, docente: course.docente },
      course.enrollments.map((e: any) => ({
        cognome: e.member.cognome,
        nome: e.member.nome,
        telefono: e.member.telefono,
        cellulare: e.member.cellulare,
      })),
    );
    const filename = `Firme_${course.titolo.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(bytes as Buffer));
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ATTENDANCE_PDF',
      entityType: 'Course',
      entityId: course.id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id/enrollments-list.pdf  — elenco iscritti (senza telefono, con data iscrizione)
router.get('/:id/enrollments-list.pdf', async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        enrollments: {
          where: { status: 'ATTIVA' },
          include: {
            member: {
              select: { cognome: true, nome: true, telefono: true, cellulare: true },
            },
          },
          orderBy: [{ member: { cognome: 'asc' } }, { member: { nome: 'asc' } }],
        },
      },
    });
    if (!course) {
      res.status(404).json({ error: 'Corso non trovato' });
      return;
    }
    const bytes = await generateEnrollmentsList(
      { codice: course.codice, titolo: course.titolo, docente: course.docente },
      course.enrollments.map((e: any) => ({
        cognome: e.member.cognome,
        nome: e.member.nome,
        telefono: e.member.telefono,
        cellulare: e.member.cellulare,
        enrollmentDate: e.createdAt,
        receiptNumber: e.receiptNumber,
      })),
    );
    const filename = `Elenco_${course.titolo.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(bytes as Buffer));
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_ENROLLMENTS_LIST_PDF',
      entityType: 'Course',
      entityId: course.id,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/courses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const enrolled = await prisma.courseEnrollment.count({ where: { courseId: req.params.id } });
    if (enrolled > 0) {
      res.status(409).json({
        error: `Corso con ${enrolled} iscrizioni: imposta status ANNULLATO invece di eliminare`,
      });
      return;
    }
    await prisma.course.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'COURSE_DELETED',
      entityType: 'Course',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

