// Generazione CSV compatibile con Excel italiano:
// - separatore ';'
// - BOM UTF-8 perché Excel italiano lo richiede per riconoscere gli accenti
// - quoting di tutti i campi che contengono ';', '"', o newline

const SEP = ';';
const BOM = '﻿';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(SEP)];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(SEP));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function formatItDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatItCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  // Excel italiano usa virgola come separatore decimale
  return (cents / 100).toFixed(2).replace('.', ',');
}
