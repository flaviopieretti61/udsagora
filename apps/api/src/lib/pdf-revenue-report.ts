import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface RevenueReportData {
  academicYearLabel: string;
  dateFrom?: string;
  dateTo?: string;
  memberships: {
    categoryName: string;
    count: number;
    dueCents: number;
    paidCents: number;
  }[];
  pendingMemberships: {
    categoryName: string;
    count: number;
    dueCents: number;
    paidCents: number;
  }[];
  courses: {
    titolo: string;
    status: string;
    count: number;
    dueCents: number;
    paidCents: number;
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
    pendingMembershipsDueCents: number;
    pendingMembershipsPaidCents: number;
    coursesDueCents: number;
    coursesPaidCents: number;
    grandPaidCents: number;
    grandDueCents: number;
    grandRefundCents: number;
    grandNetCents: number;
    grandExpensesCents?: number;
  };
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatDateItalian(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export async function generateRevenueReportPDF(data: RevenueReportData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const margin = 40;
  const lineHeight = 15;
  const smallLineHeight = 12;

  // Titolo
  page.drawText('Riepilogo Incassi', {
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
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  y -= 25;

  // KPI Summary
  page.drawText('RIEPILOGO', {
    x: margin,
    y,
    font: boldFont,
    size: 12,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight;

  const kpis = [
    { label: 'Incassato totale:', value: formatCents(data.totals.grandPaidCents) },
    { label: 'Dovuto totale:', value: formatCents(data.totals.grandDueCents) },
  ];
  const labelWidth = 150;
  for (const kpi of kpis) {
    page.drawText(kpi.label, {
      x: margin,
      y,
      font,
      size: 10,
    });
    page.drawText(kpi.value, {
      x: margin + labelWidth,
      y,
      font,
      size: 10,
    });
    y -= smallLineHeight;
  }
  y -= 10;

  // Tessere
  page.drawText('TESSERE (PER CATEGORIA)', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  const tessereColWidths = [150, 70, 70, 80, 80];
  const tessereHeaders = ['Categoria', '', 'Tessere', 'Dovuto', 'Pagato'];
  let x = margin;
  for (let i = 0; i < tessereHeaders.length; i++) {
    if (tessereHeaders[i]) {
      page.drawText(tessereHeaders[i], {
        x,
        y,
        font: boldFont,
        size: 9,
      });
    }
    x += tessereColWidths[i];
  }
  y -= smallLineHeight;

  // Tessere approvate
  for (const m of data.memberships) {
    x = margin;
    page.drawText(m.categoryName, { x, y, font, size: 8 });
    x += tessereColWidths[0] + tessereColWidths[1];
    page.drawText(String(m.count), { x, y, font, size: 8 });
    x += tessereColWidths[2];
    page.drawText(formatCents(m.dueCents), { x, y, font, size: 8 });
    x += tessereColWidths[3];
    page.drawText(formatCents(m.paidCents), { x, y, font, size: 8 });
    y -= smallLineHeight;
  }

  // Tessere in attesa
  for (const m of data.pendingMemberships) {
    x = margin;
    page.drawText(m.categoryName + ' (in attesa)', { x, y, font, size: 8 });
    x += tessereColWidths[0] + tessereColWidths[1];
    page.drawText(String(m.count), { x, y, font, size: 8 });
    x += tessereColWidths[2];
    page.drawText(formatCents(m.dueCents), { x, y, font, size: 8 });
    x += tessereColWidths[3];
    page.drawText(formatCents(m.paidCents), { x, y, font, size: 8 });
    y -= smallLineHeight;
  }
  y -= 10;

  // Corsi
  page.drawText('CORSI', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  const corsiColWidths = [150, 70, 70, 80, 80];
  const corsiHeaders = ['Corso', 'Stato', 'Iscritti', 'Dovuto', 'Pagato'];
  x = margin;
  for (let i = 0; i < corsiHeaders.length; i++) {
    page.drawText(corsiHeaders[i], { x, y, font: boldFont, size: 9 });
    x += corsiColWidths[i];
  }
  y -= smallLineHeight;

  for (const c of data.courses) {
    x = margin;
    page.drawText(c.titolo.substring(0, 25), { x, y, font, size: 8 });
    x += corsiColWidths[0];
    page.drawText(c.status, { x, y, font, size: 8 });
    x += corsiColWidths[1];
    page.drawText(String(c.count), { x, y, font, size: 8 });
    x += corsiColWidths[2];
    page.drawText(formatCents(c.dueCents), { x, y, font, size: 8 });
    x += corsiColWidths[3];
    page.drawText(formatCents(c.paidCents), { x, y, font, size: 8 });
    y -= smallLineHeight;
    if (y < 150) break;
  }
  y -= 10;

  // Incassi per metodo di pagamento
  if (data.byPaymentMethod.length > 0) {
    page.drawText('INCASSI PER METODO DI PAGAMENTO', {
      x: margin,
      y,
      font: boldFont,
      size: 11,
    });
    y -= lineHeight;

    x = margin;
    page.drawText('Metodo', { x, y, font: boldFont, size: 9 });
    x += 200;
    page.drawText('Importo', { x, y, font: boldFont, size: 9 });
    y -= smallLineHeight;

    for (const m of data.byPaymentMethod) {
      x = margin;
      page.drawText(m.method, { x, y, font, size: 8 });
      x += 200;
      page.drawText(formatCents(m.totalCents), { x, y, font, size: 8 });
      y -= smallLineHeight;
    }
    y -= 10;
  }

  // Annullamenti, Rimborsi, Spese, Differenze
  if (data.canceledEnrollments.length > 0 || (data.expenses && data.expenses.length > 0)) {
    page.drawText('ANNULLAMENTI, RIMBORSI, SPESE, DIFFERENZE', {
      x: margin,
      y,
      font: boldFont,
      size: 11,
    });
    y -= lineHeight;

    x = margin;
    page.drawText('Descrizione', { x, y, font: boldFont, size: 9 });
    x += 350;
    page.drawText('Importo', { x, y, font: boldFont, size: 9 });
    y -= smallLineHeight;

    for (const c of data.canceledEnrollments) {
      x = margin;
      page.drawText('Rimborso: ' + c.method, { x, y, font, size: 8 });
      x += 350;
      page.drawText('- ' + formatCents(c.refundCents), { x, y, font, size: 8, color: rgb(1, 0, 0) });
      y -= smallLineHeight;
    }

    for (const e of data.expenses ?? []) {
      x = margin;
      page.drawText(e.description.substring(0, 40), { x, y, font, size: 8 });
      x += 350;
      page.drawText('- ' + formatCents(e.amountCents), { x, y, font, size: 8, color: rgb(1, 0, 0) });
      y -= smallLineHeight;
    }
  }

  // Footer with generation date
  page.drawText(`Generato: ${new Date().toLocaleDateString('it-IT')}`, {
    x: margin,
    y: 30,
    font,
    size: 8,
    color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
