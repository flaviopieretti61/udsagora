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
import { generatePrivacyForm } from '../lib/pdf-privacy.js';
import { formatItDate } from '../lib/csv.js';
import {
  genderSchema,
  membershipTypeSchema,
  membershipStatusSchema,
} from '../types/enums.js';

const router = Router();
router.use(requireAuth);

// -- Schemi ----------------------------------------------------------------

const optionalString = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? undefined : s))
  .optional();

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Data non valida');

const baseMemberSchema = z.object({
  cognome: z.string().trim().min(1).max(80),
  nome: z.string().trim().min(1).max(80),
  codiceFiscale: optionalString.transform((s) => s?.toUpperCase()),
  dataNascita: optionalIsoDate,
  luogoNascita: optionalString,
  gender: genderSchema.optional().nullable(),
  indirizzo: optionalString,
  cap: optionalString,
  citta: optionalString,
  provincia: optionalString,
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  telefono: optionalString,
  cellulare: optionalString,
  categoryId: z.string().min(1),
  privacyFirmataIl: optionalIsoDate,
  note: optionalString,
});

const updateSchema = baseMemberSchema.partial();

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().optional(),
  membershipType: membershipTypeSchema.optional(),
  membershipStatus: membershipStatusSchema.optional(),
  academicYearId: z.string().optional(),
  // "NONE" filtra i soci senza iscrizione per l'anno selezionato
  noMembership: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.enum(['cognome', 'codiceFiscale', 'category', 'createdAt']).default('cognome'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

// -- Helpers ---------------------------------------------------------------

function toDateOrNull(s?: string): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === '' || s === null) return null;
  return new Date(s);
}

function buildCreateData(parsed: z.infer<typeof baseMemberSchema>): Prisma.MemberCreateInput {
  return {
    cognome: parsed.cognome,
    nome: parsed.nome,
    codiceFiscale: parsed.codiceFiscale,
    dataNascita: parsed.dataNascita ? new Date(parsed.dataNascita) : null,
    luogoNascita: parsed.luogoNascita,
    gender: parsed.gender ?? null,
    indirizzo: parsed.indirizzo,
    cap: parsed.cap,
    citta: parsed.citta,
    provincia: parsed.provincia,
    email: parsed.email,
    telefono: parsed.telefono,
    cellulare: parsed.cellulare,
    privacyFirmataIl: parsed.privacyFirmataIl ? new Date(parsed.privacyFirmataIl) : null,
    note: parsed.note,
    category: { connect: { id: parsed.categoryId } },
  };
}

function buildUpdateData(parsed: z.infer<typeof updateSchema>): Prisma.MemberUpdateInput {
  const data: Prisma.MemberUpdateInput = {};
  if (parsed.cognome !== undefined) data.cognome = parsed.cognome;
  if (parsed.nome !== undefined) data.nome = parsed.nome;
  if (parsed.codiceFiscale !== undefined) data.codiceFiscale = parsed.codiceFiscale ?? null;
  if (parsed.dataNascita !== undefined) data.dataNascita = toDateOrNull(parsed.dataNascita);
  if (parsed.luogoNascita !== undefined) data.luogoNascita = parsed.luogoNascita ?? null;
  if (parsed.gender !== undefined) data.gender = parsed.gender ?? null;
  if (parsed.indirizzo !== undefined) data.indirizzo = parsed.indirizzo ?? null;
  if (parsed.cap !== undefined) data.cap = parsed.cap ?? null;
  if (parsed.citta !== undefined) data.citta = parsed.citta ?? null;
  if (parsed.provincia !== undefined) data.provincia = parsed.provincia ?? null;
  if (parsed.email !== undefined) data.email = parsed.email ?? null;
  if (parsed.telefono !== undefined) data.telefono = parsed.telefono ?? null;
  if (parsed.cellulare !== undefined) data.cellulare = parsed.cellulare ?? null;
  if (parsed.privacyFirmataIl !== undefined)
    data.privacyFirmataIl = toDateOrNull(parsed.privacyFirmataIl);
  if (parsed.note !== undefined) data.note = parsed.note ?? null;
  if (parsed.categoryId !== undefined) data.category = { connect: { id: parsed.categoryId } };
  return data;
}

// -- Routes ----------------------------------------------------------------

// GET /api/members
router.get('/', async (req, res, next) => {
  try {
    const f = listQuerySchema.parse(req.query);

    // Risolvi anno accademico di riferimento
    let academicYearId = f.academicYearId;
    if (!academicYearId) {
      const active = await prisma.academicYear.findFirst({ where: { active: true } });
      academicYearId = active?.id;
    }

    const where: Prisma.MemberWhereInput = {};
    if (f.categoryId) where.categoryId = f.categoryId;
    if (f.q) {
      const q = f.q;
      where.OR = [
        { cognome: { contains: q, mode: 'insensitive' } },
        { nome: { contains: q, mode: 'insensitive' } },
        { codiceFiscale: { contains: q.toUpperCase(), mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (academicYearId && (f.membershipType || f.membershipStatus)) {
      where.memberships = {
        some: {
          academicYearId,
          ...(f.membershipType ? { type: f.membershipType } : {}),
          ...(f.membershipStatus ? { status: f.membershipStatus } : {}),
        },
      };
    }
    if (academicYearId && f.noMembership) {
      where.memberships = { none: { academicYearId } };
    }

    const orderBy: Prisma.MemberOrderByWithRelationInput =
      f.sortBy === 'createdAt'
        ? { createdAt: f.sortDir }
        : f.sortBy === 'codiceFiscale'
          ? { codiceFiscale: f.sortDir }
          : f.sortBy === 'category'
            ? { category: { name: f.sortDir } }
            : { cognome: f.sortDir };

    const [total, items] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        orderBy: [orderBy, { nome: 'asc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: {
          category: { select: { id: true, code: true, name: true } },
          memberships: academicYearId
            ? {
                where: { academicYearId },
                select: { id: true, type: true, status: true },
                take: 1,
              }
            : false,
        },
      }),
    ]);

    res.json({
      total,
      page: f.page,
      pageSize: f.pageSize,
      academicYearId: academicYearId ?? null,
      items: items.map((m: any) => ({
        id: m.id,
        cognome: m.cognome,
        nome: m.nome,
        codiceFiscale: m.codiceFiscale,
        email: m.email,
        telefono: m.telefono,
        cellulare: m.cellulare,
        category: m.category,
        currentMembership:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m as any).memberships?.[0]
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { id: (m as any).memberships[0].id, type: (m as any).memberships[0].type, status: (m as any).memberships[0].status }
            : null,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/members/import
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
            const cognome = values[1];
            const nome = values[2];
            const codiceFiscale = values[3];
            const dataNascita = values[4];
            const luogoNascita = values[5];
            const gender = values[6];
            const indirizzo = values[7];
            const cap = values[8];
            const citta = values[9];
            const provincia = values[10];
            const emailVal = values[11];
            const telefono = values[12];
            const categoryName = values[13];
            const privacyFirmataIl = values[14];
            const note = values[15];
            const cellulare = values[18];

            const email = typeof emailVal === 'object' ? emailVal?.text : emailVal;

            if (!cognome || !nome) {
              results.errors.push(`Riga ${rowNum}: cognome e nome obbligatori`);
              continue;
            }

            if (!categoryName) {
              results.errors.push(`Riga ${rowNum}: Categoria mancante`);
              continue;
            }

            // Risolvi l'ID della categoria dal name, altrimenti usa "Ordinario"
            let category = await prisma.memberCategory.findFirst({
              where: { name: String(categoryName).trim() },
            });

            if (!category) {
              category = await prisma.memberCategory.findFirst({
                where: { name: 'Ordinario' },
              });
              if (!category) {
                results.errors.push(`Riga ${rowNum}: Categoria "Ordinario" non trovata nel database`);
                continue;
              }
            }

            const data: Prisma.MemberCreateInput = {
              cognome: String(cognome).trim(),
              nome: String(nome).trim(),
              codiceFiscale: codiceFiscale ? String(codiceFiscale).toUpperCase().trim() : null,
              dataNascita: dataNascita instanceof Date ? dataNascita : null,
              luogoNascita: luogoNascita ? String(luogoNascita).trim() : null,
              gender: gender ? String(gender).charAt(0).toUpperCase() : null,
              indirizzo: indirizzo ? String(indirizzo).trim() : null,
              cap: cap ? String(cap).trim() : null,
              citta: citta ? String(citta).trim() : null,
              provincia: provincia ? String(provincia).trim() : null,
              email: email ? String(email).toLowerCase().trim() : null,
              telefono: telefono ? String(telefono).trim() : null,
              cellulare: cellulare ? String(cellulare).trim() : null,
              privacyFirmataIl: privacyFirmataIl instanceof Date ? privacyFirmataIl : null,
              note: note ? String(note).trim() : null,
              category: { connect: { id: category.id } },
            };

            await prisma.member.upsert({
              where: { codiceFiscale: data.codiceFiscale || '' },
              update: data,
              create: data,
            });

            if (data.codiceFiscale) {
              results.updated++;
            } else {
              results.created++;
            }
          } catch (err) {
            results.errors.push(`Riga ${rowNum}: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
          }
        }

        await audit({
          userId: req.user!.userId,
          action: 'MEMBERS_IMPORTED',
          entityType: 'Member',
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

// GET /api/members/export.xlsx  — DEVE stare prima di /:id (altrimenti :id cattura "export.xlsx")
router.get('/export.xlsx', async (req, res, next) => {
  try {
    const f = listQuerySchema.parse(req.query);
    let academicYearId = f.academicYearId;
    if (!academicYearId) {
      const active = await prisma.academicYear.findFirst({ where: { active: true } });
      academicYearId = active?.id;
    }
    const where: Prisma.MemberWhereInput = {};
    if (f.categoryId) where.categoryId = f.categoryId;
    if (f.q) {
      where.OR = [
        { cognome: { contains: f.q, mode: 'insensitive' } },
        { nome: { contains: f.q, mode: 'insensitive' } },
        { codiceFiscale: { contains: f.q.toUpperCase(), mode: 'insensitive' } },
        { email: { contains: f.q, mode: 'insensitive' } },
      ];
    }
    if (academicYearId && (f.membershipType || f.membershipStatus)) {
      where.memberships = {
        some: {
          academicYearId,
          ...(f.membershipType ? { type: f.membershipType } : {}),
          ...(f.membershipStatus ? { status: f.membershipStatus } : {}),
        },
      };
    }
    if (academicYearId && f.noMembership) {
      where.memberships = { none: { academicYearId } };
    }

    const members = await prisma.member.findMany({
      where,
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
      include: {
        category: { select: { code: true, name: true } },
        memberships: academicYearId
          ? {
              where: { academicYearId },
              select: { type: true, status: true, amountDueCents: true, amountPaidCents: true, receiptNumber: true, approvedAt: true, academicYear: { select: { label: true } }, rejectionReason: true },
              take: 1,
            }
          : false,
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Soci', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

    const headers = [
      'Cognome',
      'Nome',
      'Codice fiscale',
      'Data nascita',
      'Luogo nascita',
      'Indirizzo',
      'CAP',
      'Città',
      'Provincia',
      'Email',
      'Telefono',
      'Cellulare',
      'Categoria',
      'Data Prima Iscrizione',
      'Privacy firmata il',
      'Data Iscrizione o Rinnovo',
      'Anno Accademico',
      'Iscrizione anno - tipo',
      'Iscrizione anno - stato',
      'Iscrizione anno - dovuto',
      'Iscrizione anno - pagato',
      'Numero Blocco / Ricevuta',
      'Motivo Rifiuto',
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members.forEach((m: any, idx: number) => {
      const cur = m.memberships?.[0];
      const row = worksheet.addRow([
        m.cognome,
        m.nome,
        m.codiceFiscale ?? '',
        formatItDate(m.dataNascita),
        m.luogoNascita ?? '',
        m.indirizzo ?? '',
        m.cap ?? '',
        m.citta ?? '',
        m.provincia ?? '',
        m.email ?? '',
        m.telefono ?? '',
        m.cellulare ?? '',
        m.category.name,
        formatItDate(m.privacyFirmataIl),
        formatItDate(m.privacyFirmataIl),
        cur ? formatItDate(cur.approvedAt) : '',
        cur?.academicYear?.label ?? '',
        cur?.type ?? '',
        cur?.status ?? '',
        cur ? (cur.amountDueCents / 100).toFixed(2) : '',
        cur ? (cur.amountPaidCents / 100).toFixed(2) : '',
        cur?.receiptNumber ?? '',
        cur?.rejectionReason ?? '',
      ]);

      row.alignment = { vertical: 'top', wrapText: false };
      if (idx % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    worksheet.columns = [
      { width: 15 },
      { width: 15 },
      { width: 16 },
      { width: 14 },
      { width: 16 },
      { width: 18 },
      { width: 8 },
      { width: 14 },
      { width: 12 },
      { width: 18 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 10 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 20 },
      { width: 30 },
    ];

    worksheet.autoFilter = 'A1:W1';
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="soci.xlsx"');
    res.send(buffer as unknown as Buffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/members/:id
router.get('/:id', async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        memberships: {
          include: { academicYear: true, approvedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        courseEnrollments: {
          include: { course: { include: { academicYear: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!member) {
      res.status(404).json({ error: 'Socio non trovato' });
      return;
    }
    res.json({ member });
  } catch (err) {
    next(err);
  }
});

// POST /api/members
router.post('/', async (req, res, next) => {
  try {
    const parsed = baseMemberSchema.parse(req.body);
    const created = await prisma.member.create({ data: buildCreateData(parsed) });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBER_CREATED',
      entityType: 'Member',
      entityId: created.id,
      payload: { cognome: created.cognome, nome: created.nome },
    });
    res.status(201).json({ member: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/members/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const updated = await prisma.member.update({
      where: { id: req.params.id },
      data: buildUpdateData(parsed),
    });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBER_UPDATED',
      entityType: 'Member',
      entityId: updated.id,
      payload: Object.keys(parsed),
    });
    res.json({ member: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// GET /api/members/:id/privacy-form.pdf?type=NUOVO|RINNOVO
router.get('/:id/privacy-form.pdf', async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({ where: { id: req.params.id } });
    if (!member) {
      res.status(404).json({ error: 'Socio non trovato' });
      return;
    }
    // Usa il parametro 'type' dalla query string, oppure determina dal numero di iscrizioni
    const typeParam = req.query.type as string | undefined;
    let isNuovo: boolean;
    if (typeParam === 'NUOVO') {
      isNuovo = true;
    } else if (typeParam === 'RINNOVO') {
      isNuovo = false;
    } else {
      // Default: determina automaticamente
      isNuovo = (await prisma.membership.count({ where: { memberId: member.id } })) === 0;
    }
    const bytes = await generatePrivacyForm(
      {
        cognome: member.cognome,
        nome: member.nome,
        codiceFiscale: member.codiceFiscale,
        dataNascita: member.dataNascita,
        luogoNascita: member.luogoNascita,
        indirizzo: member.indirizzo,
        cap: member.cap,
        citta: member.citta,
        provincia: member.provincia,
        email: member.email,
        telefono: member.telefono,
        cellulare: member.cellulare,
      },
      { nuovoIscritto: isNuovo },
    );
    const filename = `Scheda_${member.cognome}_${member.nome}.pdf`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(bytes));
    await audit({
      userId: req.user!.userId,
      action: 'MEMBER_PRIVACY_PDF',
      entityType: 'Member',
      entityId: member.id,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/members/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const counts = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { memberships: true, courseEnrollments: true } } },
    });
    if (!counts) {
      res.status(404).json({ error: 'Socio non trovato' });
      return;
    }
    if (counts._count.memberships > 0 || counts._count.courseEnrollments > 0) {
      res.status(409).json({
        error: 'Socio con iscrizioni o iscrizioni a corsi: impossibile eliminare',
      });
      return;
    }
    await prisma.member.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'MEMBER_DELETED',
      entityType: 'Member',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

