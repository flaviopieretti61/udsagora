import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface CashClosingPDFData {
  closureDate: string;
  academicYearLabel: string;
  operatorName: string;
  expectedCashFromMemberships: number;
  expectedCashFromCourses: number;
  expensesTotal: number;
  previousPettyCash: number;
  countedCashTotal: number;
  pettyCashRemaining: number;
  bankDepositAmount: number;
  bankDepositNumber?: string;
  bankDepositDate?: string;
  difference: number;
  notes?: string;
  denominationCounts: {
    denominationCents: number;
    quantity: number;
    subtotal: number;
  }[];
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatDateItalian(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getDenominationLabel(cents: number): string {
  const labels: Record<number, string> = {
    10000: 'Banconota 100€',
    5000: 'Banconota 50€',
    2000: 'Banconota 20€',
    1000: 'Banconota 10€',
    500: 'Banconota 5€',
    200: 'Moneta 2€',
    100: 'Moneta 1€',
  };
  return labels[cents] || `${cents / 100}€`;
}

export async function generateCashClosingPDF(data: CashClosingPDFData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const margin = 40;
  const lineHeight = 15;
  const smallLineHeight = 12;

  // Title
  page.drawText('Chiusura di Cassa Giornaliera', {
    x: margin,
    y,
    font: boldFont,
    size: 18,
    color: rgb(0, 0, 0),
  });
  y -= 30;

  // Header info
  page.drawText(`Data: ${formatDateItalian(data.closureDate)}`, {
    x: margin,
    y,
    font,
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText(`Anno: ${data.academicYearLabel}`, {
    x: margin + 200,
    y,
    font,
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText(`Operatore: ${data.operatorName}`, {
    x: margin + 350,
    y,
    font,
    size: 10,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 25;

  // Expected cash section
  page.drawText('CONTANTI ATTESI', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  const expectedItems = [
    { label: 'Fondo Cassa Precedente', value: data.previousPettyCash },
    { label: 'Iscrizioni (contanti)', value: data.expectedCashFromMemberships },
    { label: 'Corsi (contanti)', value: data.expectedCashFromCourses },
    { label: 'Spese e differenze', value: -data.expensesTotal },
  ];

  for (const item of expectedItems) {
    page.drawText(item.label, { x: margin, y, font, size: 10 });
    page.drawText(formatCents(item.value), { x: margin + 300, y, font, size: 10 });
    y -= smallLineHeight;
  }

  const expectedTotal =
    data.previousPettyCash +
    data.expectedCashFromMemberships +
    data.expectedCashFromCourses -
    data.expensesTotal;
  page.drawText('TOTALE ATTESO', {
    x: margin,
    y: y - 5,
    font: boldFont,
    size: 11,
    color: rgb(0, 0, 0.6),
  });
  page.drawText(formatCents(expectedTotal), {
    x: margin + 300,
    y: y - 5,
    font: boldFont,
    size: 11,
    color: rgb(0, 0, 0.6),
  });
  y -= 25;

  // Denominations section
  page.drawText('CONTEGGIO CONTANTI FISICI', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  const denomCols = [180, 80, 80];
  let x = margin;
  page.drawText('Taglio', { x, y, font: boldFont, size: 9 });
  x += denomCols[0];
  page.drawText('Quantità', { x, y, font: boldFont, size: 9 });
  x += denomCols[1];
  page.drawText('Subtotale', { x, y, font: boldFont, size: 9 });
  y -= smallLineHeight;

  for (const denom of data.denominationCounts) {
    x = margin;
    page.drawText(getDenominationLabel(denom.denominationCents), {
      x,
      y,
      font,
      size: 8,
    });
    x += denomCols[0];
    page.drawText(String(denom.quantity), { x, y, font, size: 8 });
    x += denomCols[1];
    page.drawText(formatCents(denom.subtotal), { x, y, font, size: 8 });
    y -= smallLineHeight;
  }

  y -= 5;
  x = margin;
  page.drawText('TOTALE RILEVATO', {
    x,
    y,
    font: boldFont,
    size: 9,
    color: rgb(0, 0, 0.6),
  });
  x += denomCols[0];
  page.drawText('', { x, y, font, size: 9 });
  x += denomCols[1];
  page.drawText(formatCents(data.countedCashTotal), {
    x,
    y,
    font: boldFont,
    size: 9,
    color: rgb(0, 0, 0.6),
  });
  y -= 20;

  // Allocation section
  page.drawText('ALLOCAZIONE', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  const allocItems = [
    { label: 'Fondo Cassa Restante', value: data.pettyCashRemaining },
    { label: 'Versamento Banca', value: data.bankDepositAmount },
  ];

  for (const item of allocItems) {
    page.drawText(item.label, { x: margin, y, font, size: 10 });
    page.drawText(formatCents(item.value), { x: margin + 300, y, font, size: 10 });
    y -= smallLineHeight;
  }
  y -= 10;

  // Difference
  page.drawText('DIFFERENZA DI CASSA', {
    x: margin,
    y,
    font: boldFont,
    size: 11,
  });
  y -= lineHeight;

  const diffLabel =
    data.difference === 0 ? 'PERFETTO' : data.difference > 0 ? 'ESUBERO' : 'AMMANCO';
  const diffColor =
    data.difference === 0
      ? rgb(0.1, 0.5, 0.1)
      : data.difference > 0
        ? rgb(0.8, 0.5, 0)
        : rgb(0.8, 0.1, 0.1);

  page.drawText(formatCents(data.difference), {
    x: margin,
    y,
    font: boldFont,
    size: 14,
    color: diffColor,
  });
  page.drawText(diffLabel, {
    x: margin + 250,
    y,
    font: boldFont,
    size: 11,
    color: diffColor,
  });
  y -= 25;

  // Bank deposit details
  if (data.bankDepositNumber || data.bankDepositDate) {
    page.drawText('DETTAGLI VERSAMENTO', {
      x: margin,
      y,
      font: boldFont,
      size: 10,
    });
    y -= lineHeight;

    if (data.bankDepositNumber) {
      page.drawText(`Numero: ${data.bankDepositNumber}`, {
        x: margin,
        y,
        font,
        size: 9,
      });
      y -= smallLineHeight;
    }

    if (data.bankDepositDate) {
      page.drawText(`Data: ${formatDateItalian(data.bankDepositDate)}`, {
        x: margin,
        y,
        font,
        size: 9,
      });
      y -= smallLineHeight;
    }
    y -= 10;
  }

  // Notes
  if (data.notes) {
    page.drawText('NOTE', {
      x: margin,
      y,
      font: boldFont,
      size: 10,
    });
    y -= lineHeight;

    const noteLines = data.notes.split('\n');
    for (const line of noteLines) {
      if (y < 80) break;
      page.drawText(line.substring(0, 80), {
        x: margin,
        y,
        font,
        size: 9,
      });
      y -= smallLineHeight;
    }
  }

  // Footer
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
