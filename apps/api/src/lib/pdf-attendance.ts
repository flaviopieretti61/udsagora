// Generazione di fogli per corsi:
// 1. "Foglio Firme di Presenza" — template assets/Template_Firme_Corso.pdf (senza data)
// 2. "Elenco Iscritti" — template assets/Template_Iscritti_Corso.pdf (con data iscrizione)
//
// Il template stampa una pagina con tabella numerata 1-24 + 3 righe vuote.
// - Se iscritti ≤ 24 → 1 pagina, eventuali righe extra restano in bianco.
// - Se iscritti > 24 → più pagine, ognuna ripartendo da 1 nei numeri di riga.
//   Si scrive "Pag X/Y" in basso per riferimento.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FIRME_PATH = path.resolve(__dirname, '../../../../assets/Template_Firme_Corso.pdf');
const TEMPLATE_ISCRITTI_PATH = path.resolve(__dirname, '../../../../assets/Template_Iscritti_Corso.pdf');

const ROWS_PER_PAGE = 28;

// Coordinate raccolte qui per ritocchi rapidi (in pt, origine bottom-left, A4 595.3 × 841.9).
const C = {
  font: 10,
  fontHeader: 14,
  // Intestazione
  corso: { x: 195, y: 730 },
  docente: { x: 195, y: 708 },
  responsabile: { x: 195, y: 673 }, // lasciato vuoto: la segreteria scrive a mano
  lezione: { x: 195, y: 643 },
  data: { x: 410, y: 643 },
  // Tabella: prima riga (riga 1) e step verticale
  firstRow: 620,
  rowStep: 20.3,
  // Colonne
  col: {
    numero: 55,
    cognome: 82,
    nome: 194,
    telefono: 300,
    enrollmentDate: 400,
    receiptNumber: 480,
  },
  // Footer pagina
  pageInfo: { x: 500, y: 30 },
} as const;

export interface AttendanceCourse {
  codice?: string | null;
  titolo: string;
  docente?: string | null;
}

export interface AttendanceMember {
  cognome: string;
  nome: string;
  telefono?: string | null;
  cellulare?: string | null;
  enrollmentDate?: string | null;
  receiptNumber?: string | null;
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number = C.font,
): void {
  if (!text) return;
  page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
}

function fmtCorsoLabel(course: AttendanceCourse): string {
  return [course.codice, course.titolo].filter(Boolean).join(' ');
}

// Genera "Foglio Firme di Presenza" — SOLO cognome e nome (niente telefono, niente data)
export async function generateAttendanceSheet(
  course: AttendanceCourse,
  members: AttendanceMember[],
): Promise<Uint8Array> {
  const templateBytes = await readFile(TEMPLATE_FIRME_PATH);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  // Ordina i membri alfabeticamente per cognome, poi per nome
  const sortedMembers = [...members].sort((a, b) => {
    const cognomeComp = a.cognome.localeCompare(b.cognome);
    return cognomeComp !== 0 ? cognomeComp : a.nome.localeCompare(b.nome);
  });

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / ROWS_PER_PAGE));
  const corsoLabel = fmtCorsoLabel(course);

  for (let p = 0; p < totalPages; p++) {
    const src = await PDFDocument.load(templateBytes);
    const [embedded] = await out.copyPages(src, [0]);
    out.addPage(embedded);
    const page = out.getPage(out.getPageCount() - 1);

    // Intestazione (uguale su ogni pagina) — nome corso e docente in bold 14
    drawText(page, fontBold, corsoLabel.substring(0,40), C.corso.x, C.corso.y, C.fontHeader);
    drawText(page, fontBold, course.docente ?? '', C.docente.x, C.docente.y, C.fontHeader);

    // Iscritti della pagina corrente (solo cognome e nome)
    const slice = sortedMembers.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
    slice.forEach((m, idx) => {
      const y = C.firstRow - idx * C.rowStep;
      const numero = p * ROWS_PER_PAGE + idx + 1;
      drawText(page, font, String(numero), C.col.numero, y);
      drawText(page, font, m.cognome.toUpperCase(), C.col.cognome, y);
      drawText(page, font, m.nome.toUpperCase(), C.col.nome, y);
    });

    if (totalPages > 1) {
      drawText(page, font, `Pag ${p + 1} di ${totalPages}`, C.pageInfo.x, C.pageInfo.y, 9);
    }
  }

  return out.save();
}

// Genera "Elenco Iscritti" — con telefono e data iscrizione
export async function generateEnrollmentsList(
  course: AttendanceCourse,
  members: AttendanceMember[],
): Promise<Uint8Array> {
  const templateBytes = await readFile(TEMPLATE_ISCRITTI_PATH);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  // Ordina i membri alfabeticamente per cognome, poi per nome
  const sortedMembers = [...members].sort((a, b) => {
    const cognomeComp = a.cognome.localeCompare(b.cognome);
    return cognomeComp !== 0 ? cognomeComp : a.nome.localeCompare(b.nome);
  });

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / ROWS_PER_PAGE));
  const corsoLabel = fmtCorsoLabel(course);

  for (let p = 0; p < totalPages; p++) {
    const src = await PDFDocument.load(templateBytes);
    const [embedded] = await out.copyPages(src, [0]);
    out.addPage(embedded);
    const page = out.getPage(out.getPageCount() - 1);

    // Intestazione (uguale su ogni pagina) — nome corso e docente in bold 14
    drawText(page, fontBold, corsoLabel.substring(0,40), C.corso.x, C.corso.y, C.fontHeader);
    drawText(page, fontBold, course.docente ?? '', C.docente.x, C.docente.y, C.fontHeader);

    // Iscritti della pagina corrente (con telefono e data iscrizione)
    const slice = sortedMembers.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
    slice.forEach((m, idx) => {
      const y = C.firstRow - idx * C.rowStep;
      const numero = p * ROWS_PER_PAGE + idx + 1;
      drawText(page, font, String(numero), C.col.numero, y);
      drawText(page, font, m.cognome.toUpperCase(), C.col.cognome, y);
      drawText(page, font, m.nome.toUpperCase(), C.col.nome, y);
      // Telefono
      drawText(page, font, m.cellulare ?? m.telefono ?? '', C.col.telefono, y);
      // Data di iscrizione
      if (m.enrollmentDate) {
        const dateStr = new Date(m.enrollmentDate).toLocaleDateString('it-IT');
        drawText(page, font, dateStr, C.col.enrollmentDate, y);
      }
      // Numero blocco / ricevuta
      drawText(page, font, m.receiptNumber ?? '', C.col.receiptNumber, y);
    });

    if (totalPages > 1) {
      drawText(page, font, `Pag ${p + 1} di ${totalPages}`, C.pageInfo.x, C.pageInfo.y, 9);
    }
  }

  return out.save();
}
