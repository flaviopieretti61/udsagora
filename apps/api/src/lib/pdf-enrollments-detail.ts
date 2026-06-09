import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface EnrollmentsDetailData {
  academicYearLabel: string;
  dateFrom?: string;
  dateTo?: string;
  memberships: {
    member: { cognome: string; nome: string };
    type: string;
    status: string;
    amountDueCents: number;
    amountPaidCents: number;
    paymentMethod: string | null;
    receiptNumber: string | null;
    createdAt: string;
  }[];
  membershipsSummary: {
    type: string;
    status: string;
    paymentMethod: string | null;
    count: number;
    totalDueCents: number;
    totalPaidCents: number;
  }[];
  courseEnrollments: {
    member: { cognome: string; nome: string };
    course: { titolo: string };
    status: string;
    amountDueCents: number;
    amountPaidCents: number;
    paymentMethod: string | null;
    receiptNumber: string | null;
    createdAt: string;
  }[];
  courseEnrollmentsSummary: {
    status: string;
    paymentMethod: string | null;
    count: number;
    totalDueCents: number;
    totalPaidCents: number;
  }[];
  byPaymentMethod: {
    method: string;
    totalCents: number;
  }[];
  canceledEnrollments: {
    method: string;
    refundCents: number;
  }[];
  expenses?: {
    expenseDate: string;
    description: string;
    amountCents: number;
  }[];
  totals: {
    membershipsDueCents: number;
    membershipsPaidCents: number;
    courseEnrollmentsDueCents: number;
    courseEnrollmentsPaidCents: number;
    grandPaidCents: number;
  };
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatDateItalian(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTimeItalian(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleDateString('it-IT');
}

export async function generateEnrollmentsDetailPDF(data: EnrollmentsDetailData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const margin = 40;
  const lineHeight = 15;
  const smallLineHeight = 12;

  // Titolo
  page.drawText('Dettaglio Iscrizioni', {
    x: margin,
    y,
    font: boldFont,
    size: 18,
    color: rgb(0, 0, 0),
  });
  y -= 30;

  // Anno accademico e date
  page.drawText(`Anno: ${data.academicYearLabel}`, {
    x: margin,
    y,
    font,
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
  });
  if (data.dateFrom || data.dateTo) {
    let periodText = '';
    if (data.dateFrom && data.dateTo && data.dateFrom === data.dateTo) {
      periodText = formatDateItalian(data.dateFrom);
    } else {
      const dates = [];
      if (data.dateFrom) dates.push(formatDateItalian(data.dateFrom));
      if (data.dateTo) dates.push(formatDateItalian(data.dateTo));
      periodText = dates.join(' - ');
    }
    page.drawText(`Periodo: ${periodText}`, {
      x: margin + 200,
      y,
      font,
      size: 10,
    });
  }
  y -= 25;

  // ========== SEZIONE 1: TESSERE ==========
  page.drawText('SEZIONE 1: ISCRIZIONI TESSERE', {
    x: margin,
    y,
    font: boldFont,
    size: 12,
    color: rgb(0.2, 0.2, 0.6),
  });
  y -= lineHeight;

  // Lista tessere
  const tessereColWidths = [80, 80, 50, 50, 50, 50, 50, 60];
  const tessereHeaders = ['Cognome', 'Nome', 'Data', 'Tipo', 'Stato', 'Dovuto', 'Pagato', 'N. Ricevuta'];
  let x = margin;
  for (let i = 0; i < tessereHeaders.length; i++) {
    page.drawText(tessereHeaders[i], {
      x,
      y,
      font: boldFont,
      size: 8,
    });
    x += tessereColWidths[i];
  }
  y -= smallLineHeight;

  for (const m of data.memberships) {
    if (y < 100) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    x = margin;
    page.drawText(m.member.cognome.substring(0, 15), { x, y, font, size: 7 });
    x += tessereColWidths[0];
    page.drawText(m.member.nome.substring(0, 15), { x, y, font, size: 7 });
    x += tessereColWidths[1];
    page.drawText(formatDateTimeItalian(m.createdAt), { x, y, font, size: 7 });
    x += tessereColWidths[2];
    page.drawText(m.type, { x, y, font, size: 7 });
    x += tessereColWidths[3];
    page.drawText(m.status, { x, y, font, size: 7 });
    x += tessereColWidths[4];
    page.drawText(formatCents(m.amountDueCents), { x, y, font, size: 7 });
    x += tessereColWidths[5];
    page.drawText(formatCents(m.amountPaidCents), { x, y, font, size: 7 });
    x += tessereColWidths[6];
    page.drawText(m.receiptNumber ?? '', { x, y, font, size: 7 });
    y -= smallLineHeight;
  }

  y -= 10;

  // Sommario tessere
  if (y < 150) {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
  }

  page.drawText('Riepilogo Tessere (per Tipo/Stato/Metodo)', {
    x: margin,
    y,
    font: boldFont,
    size: 10,
  });
  y -= lineHeight;

  const summaryColWidths = [50, 60, 70, 40, 40, 50, 50];
  const summaryHeaders = ['Tipo', 'Stato', 'Metodo', 'Conti', 'Dovuto', 'Pagato'];
  x = margin;
  for (let i = 0; i < summaryHeaders.length; i++) {
    page.drawText(summaryHeaders[i], {
      x,
      y,
      font: boldFont,
      size: 8,
    });
    x += summaryColWidths[i];
  }
  y -= smallLineHeight;

  for (const s of data.membershipsSummary) {
    if (y < 100) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    x = margin;
    page.drawText(s.type, { x, y, font, size: 7 });
    x += summaryColWidths[0];
    page.drawText(s.status, { x, y, font, size: 7 });
    x += summaryColWidths[1];
    page.drawText(s.paymentMethod || '-', { x, y, font, size: 7 });
    x += summaryColWidths[2];
    page.drawText(String(s.count), { x, y, font, size: 7 });
    x += summaryColWidths[3];
    page.drawText(formatCents(s.totalDueCents), { x, y, font, size: 7 });
    x += summaryColWidths[4];
    page.drawText(formatCents(s.totalPaidCents), { x, y, font, size: 7 });
    y -= smallLineHeight;
  }

  y -= 15;

  // ========== SEZIONE 2: CORSI ==========
  if (y < 150) {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
  }

  page.drawText('SEZIONE 2: ISCRIZIONI AI CORSI', {
    x: margin,
    y,
    font: boldFont,
    size: 12,
    color: rgb(0.2, 0.2, 0.6),
  });
  y -= lineHeight;

  // Lista iscrizioni ai corsi
  const corsiColWidths = [70, 70, 100, 50, 50, 50, 50, 55];
  const corsiHeaders = ['Cognome', 'Nome', 'Corso', 'Data', 'Stato', 'Dovuto', 'Pagato', 'N. Ricevuta'];
  x = margin;
  for (let i = 0; i < corsiHeaders.length; i++) {
    page.drawText(corsiHeaders[i], {
      x,
      y,
      font: boldFont,
      size: 8,
    });
    x += corsiColWidths[i];
  }
  y -= smallLineHeight;

  for (const e of data.courseEnrollments) {
    if (y < 100) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    x = margin;
    page.drawText(e.member.cognome.substring(0, 12), { x, y, font, size: 7 });
    x += corsiColWidths[0];
    page.drawText(e.member.nome.substring(0, 12), { x, y, font, size: 7 });
    x += corsiColWidths[1];
    page.drawText(e.course.titolo.substring(0, 18), { x, y, font, size: 7 });
    x += corsiColWidths[2];
    page.drawText(formatDateTimeItalian(e.createdAt), { x, y, font, size: 7 });
    x += corsiColWidths[3];
    page.drawText(e.status, { x, y, font, size: 7 });
    x += corsiColWidths[4];
    page.drawText(formatCents(e.amountDueCents), { x, y, font, size: 7 });
    x += corsiColWidths[5];
    page.drawText(formatCents(e.amountPaidCents), { x, y, font, size: 7 });
    x += corsiColWidths[6];
    page.drawText(e.receiptNumber ?? '', { x, y, font, size: 7 });
    y -= smallLineHeight;
  }

  y -= 10;

  // Sommario corsi
  if (y < 150) {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
  }

  page.drawText('Riepilogo Iscrizioni Corsi (per Metodo)', {
    x: margin,
    y,
    font: boldFont,
    size: 10,
  });
  y -= lineHeight;

  const coursesSummaryHeaders = ['Metodo', 'Count', 'Dovuto', 'Pagato'];
  const coursesSummaryColWidths = [80, 50, 60, 60];
  x = margin;
  for (let i = 0; i < coursesSummaryHeaders.length; i++) {
    page.drawText(coursesSummaryHeaders[i], {
      x,
      y,
      font: boldFont,
      size: 8,
    });
    x += coursesSummaryColWidths[i];
  }
  y -= smallLineHeight;

  for (const s of data.courseEnrollmentsSummary) {
    if (y < 100) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }
    x = margin;
    page.drawText(s.paymentMethod || '-', { x, y, font, size: 7 });
    x += coursesSummaryColWidths[0];
    page.drawText(String(s.count), { x, y, font, size: 7 });
    x += coursesSummaryColWidths[1];
    page.drawText(formatCents(s.totalDueCents), { x, y, font, size: 7 });
    x += coursesSummaryColWidths[2];
    page.drawText(formatCents(s.totalPaidCents), { x, y, font, size: 7 });
    y -= smallLineHeight;
  }

  y -= 15;

  // ========== SEZIONE 3: RIEPILOGO INCASSI ==========
  if (y < 150) {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
  }

  page.drawText('SEZIONE 3: RIEPILOGO INCASSI', {
    x: margin,
    y,
    font: boldFont,
    size: 12,
    color: rgb(0.2, 0.2, 0.6),
  });
  y -= lineHeight;

  // Incassi per metodo
  if (data.byPaymentMethod.length > 0) {
    page.drawText('Incassi per Metodo di Pagamento:', {
      x: margin,
      y,
      font: boldFont,
      size: 10,
    });
    y -= lineHeight;

    x = margin;
    page.drawText('Metodo', { x, y, font: boldFont, size: 9 });
    x += 250;
    page.drawText('Importo', { x, y, font: boldFont, size: 9 });
    y -= smallLineHeight;

    for (const m of data.byPaymentMethod) {
      x = margin;
      page.drawText(m.method, { x, y, font, size: 8 });
      x += 250;
      page.drawText(formatCents(m.totalCents), { x, y, font, size: 8 });
      y -= smallLineHeight;
    }
    y -= 10;
  }

  // Annullamenti, Rimborsi, Spese, Differenze
  if (data.canceledEnrollments.length > 0 || (data.expenses && data.expenses.length > 0)) {
    page.drawText('Annullamenti, Rimborsi, Spese, Differenze:', {
      x: margin,
      y,
      font: boldFont,
      size: 10,
    });
    y -= lineHeight;

    x = margin;
    page.drawText('Descrizione', { x, y, font: boldFont, size: 9 });
    x += 300;
    page.drawText('Importo', { x, y, font: boldFont, size: 9 });
    y -= smallLineHeight;

    for (const c of data.canceledEnrollments) {
      x = margin;
      page.drawText('Rimborso: ' + c.method, { x, y, font, size: 8 });
      x += 300;
      page.drawText(`- ${formatCents(c.refundCents)}`, { x, y, font, size: 8, color: rgb(1, 0, 0) });
      y -= smallLineHeight;
    }

    for (const e of data.expenses ?? []) {
      x = margin;
      page.drawText(e.description.substring(0, 35), { x, y, font, size: 8 });
      x += 300;
      page.drawText(`- ${formatCents(e.amountCents)}`, { x, y, font, size: 8, color: rgb(1, 0, 0) });
      y -= smallLineHeight;
    }
    y -= 10;
  }

  // Totali (tabella)
  y -= 10;
  page.drawText('TOTALI:', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  // Header della tabella totali
  const totaliColWidths = [150, 100, 100];
  const totaliHeaders = ['Categoria', 'Dovuto', 'Pagato'];
  x = margin;
  for (let i = 0; i < totaliHeaders.length; i++) {
    page.drawText(totaliHeaders[i], {
      x,
      y,
      font: boldFont,
      size: 9,
    });
    x += totaliColWidths[i];
  }
  y -= smallLineHeight;

  // Riga Tessere
  x = margin;
  page.drawText('Tessere', { x, y, font, size: 8 });
  x += totaliColWidths[0];
  page.drawText(formatCents(data.totals.membershipsDueCents), { x, y, font, size: 8 });
  x += totaliColWidths[1];
  page.drawText(formatCents(data.totals.membershipsPaidCents), { x, y, font, size: 8 });
  y -= smallLineHeight;

  // Riga Corsi
  x = margin;
  page.drawText('Corsi', { x, y, font, size: 8 });
  x += totaliColWidths[0];
  page.drawText(formatCents(data.totals.courseEnrollmentsDueCents), { x, y, font, size: 8 });
  x += totaliColWidths[1];
  page.drawText(formatCents(data.totals.courseEnrollmentsPaidCents), { x, y, font, size: 8 });
  y -= smallLineHeight;

  // Riga Grand Total (con sfondo)
  y -= 5;
  page.drawText('Grand Total Pagato', { x: margin, y, font: boldFont, size: 9 });
  x = margin + totaliColWidths[0] + totaliColWidths[1];
  page.drawText(formatCents(data.totals.grandPaidCents), { x, y, font: boldFont, size: 9 });

  // Footer
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const footerPage = pdfDoc.getPage(i);
    footerPage.drawText(`Pag ${i + 1}/${pageCount}`, {
      x: 550,
      y: 20,
      font,
      size: 8,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  return Buffer.from(await pdfDoc.save());
}
