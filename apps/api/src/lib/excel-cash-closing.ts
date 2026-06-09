import * as XLSX from 'xlsx';

interface CashClosingExcelData {
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

function formatCents(cents: number): number {
  return cents / 100;
}

function formatDateItalian(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT');
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

export function generateCashClosingExcel(data: CashClosingExcelData): Buffer {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['CHIUSURA DI CASSA GIORNALIERA'],
    [],
    ['Data', formatDateItalian(data.closureDate)],
    ['Anno Accademico', data.academicYearLabel],
    ['Operatore', data.operatorName],
    ['Data Generazione', formatDateItalian(new Date().toISOString())],
    [],
    ['CONTANTI ATTESI'],
    ['Fondo Cassa Precedente', formatCents(data.previousPettyCash)],
    ['Iscrizioni (contanti)', formatCents(data.expectedCashFromMemberships)],
    ['Corsi (contanti)', formatCents(data.expectedCashFromCourses)],
    ['Spese e differenze', formatCents(-data.expensesTotal)],
    [
      'TOTALE ATTESO',
      formatCents(
        data.previousPettyCash +
          data.expectedCashFromMemberships +
          data.expectedCashFromCourses -
          data.expensesTotal,
      ),
    ],
    [],
    ['CONTEGGIO CONTANTI FISICI'],
  ];

  for (const denom of data.denominationCounts) {
    summaryData.push([
      getDenominationLabel(denom.denominationCents),
      denom.quantity,
      formatCents(denom.subtotal),
    ]);
  }

  summaryData.push(
    [],
    ['TOTALE RILEVATO', '', formatCents(data.countedCashTotal)],
    [],
    ['ALLOCAZIONE'],
    ['Fondo Cassa Restante', formatCents(data.pettyCashRemaining)],
    ['Versamento Banca', formatCents(data.bankDepositAmount)],
    [],
    ['DIFFERENZA', formatCents(data.difference)],
  );

  if (data.bankDepositNumber || data.bankDepositDate) {
    summaryData.push(
      [],
      ['DETTAGLI VERSAMENTO'],
    );
    if (data.bankDepositNumber) {
      summaryData.push(['Numero Versamento', data.bankDepositNumber]);
    }
    if (data.bankDepositDate) {
      summaryData.push(['Data Versamento', formatDateItalian(data.bankDepositDate)]);
    }
  }

  if (data.notes) {
    summaryData.push(
      [],
      ['NOTE'],
      [data.notes],
    );
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo');

  // Sheet 2: Denomination Details
  const denomData: (string | number)[][] = [
    ['Taglio', 'Quantità', 'Subtotale (€)'],
  ];

  for (const denom of data.denominationCounts) {
    denomData.push([
      getDenominationLabel(denom.denominationCents),
      denom.quantity,
      formatCents(denom.subtotal),
    ]);
  }

  denomData.push(
    [],
    ['TOTALE', '', formatCents(data.countedCashTotal)],
  );

  const denomSheet = XLSX.utils.aoa_to_sheet(denomData);
  denomSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, denomSheet, 'Tagli');

  // Generate file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return excelBuffer;
}
