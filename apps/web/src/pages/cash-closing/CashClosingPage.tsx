import { useState, useMemo, useEffect, useRef } from 'react';
import { PageHeader } from '../../components/PageHeader.js';
import { useLastCashClosureDate, useCashClosing, useCreateCashClosing, useUpdateCashClosing, useCashClosingHistory, useExpectedCashForDate } from '../../hooks/useCashClosing.js';
import { useCurrentAcademicYear } from '../../hooks/useAcademicYears.js';
import { centsToEuros, formatDate, toInputDate } from '../../lib/format.js';
import type { CashClosingDenomination } from '../../types.js';

const DENOMINATIONS = [
  { cents: 10000, label: 'Banconota 100€' },
  { cents: 5000, label: 'Banconota 50€' },
  { cents: 2000, label: 'Banconota 20€' },
  { cents: 1000, label: 'Banconota 10€' },
  { cents: 500, label: 'Banconota 5€' },
  { cents: 200, label: 'Moneta 2€' },
  { cents: 100, label: 'Moneta 1€' },
];

export function CashClosingPage() {
  const { data: activeYear } = useCurrentAcademicYear();
  const yearId = activeYear?.id || '';

  const [closureDate, setClosureDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [denominationCounts, setDenominationCounts] = useState<Record<number, number>>({});
  const [pettyCashRemaining, setPettyCashRemaining] = useState<number>(0);
  const [pettyCashFocused, setPettyCashFocused] = useState<boolean>(false);
  const [bankDepositNumber, setBankDepositNumber] = useState<string>('');
  const [bankDepositDate, setBankDepositDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const { data: lastClosureDate } = useLastCashClosureDate();
  const { data: closure } = useCashClosing(closureDate);
  const { data: expectedCash } = useExpectedCashForDate(closureDate, yearId);
  const { data: history } = useCashClosingHistory(yearId);
  const createClosure = useCreateCashClosing();
  const updateClosure = useUpdateCashClosing(closure?.id || '');

  // Initialize denominations from loaded closure or defaults
  const loadedDenoms = useMemo(() => {
    if (!closure) return {};
    const result: Record<number, number> = {};
    closure.denominationCounts.forEach((denom) => {
      const index = DENOMINATIONS.findIndex((d) => d.cents === denom.denominationCents);
      if (index >= 0) result[index] = denom.quantity;
    });
    return result;
  }, [closure]);

  // Tracks the date for which the open-day form was last (re)initialised, so we
  // don't re-wipe an operator's in-progress entry when unrelated queries refetch.
  const initializedFor = useRef<string | null>(null);

  // Sync form state when the selected closure changes. Keyed on closureDate (+
  // whether a saved closure exists) so it fires when navigating between dates,
  // NOT on every background refetch of unrelated queries — which would wipe
  // in-progress counting for an open day (bug M4).
  useEffect(() => {
    if (closure) {
      setDenominationCounts(loadedDenoms);
      setPettyCashRemaining(closure.pettyCashRemaining);
      setBankDepositNumber(closure.bankDepositNumber || '');
      setBankDepositDate(closure.bankDepositDate ? toInputDate(closure.bankDepositDate) : '');
      setNotes(closure.notes || '');
      initializedFor.current = closureDate;
    } else {
      setDenominationCounts({});
      setPettyCashRemaining(0);
      setBankDepositNumber('');
      setBankDepositDate('');
      setNotes('');
      // Defer petty-cash pre-fill to the effect below (expectedCash may not be loaded yet).
      initializedFor.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closureDate, closure?.id]);

  // For an OPEN day, pre-fill "Fondo Cassa Restante" with the previous closure's
  // leftover once expectedCash arrives — but only once per date, so it never
  // overwrites a value the operator has started editing.
  useEffect(() => {
    if (!closure && expectedCash && initializedFor.current !== closureDate) {
      setPettyCashRemaining(expectedCash.previousPettyCash || 0);
      initializedFor.current = closureDate;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closure, expectedCash, closureDate]);

  // Calculate totals
  const countedCashTotal = useMemo(() => {
    return Object.entries(denominationCounts).reduce((sum, [idx, qty]) => {
      return sum + DENOMINATIONS[parseInt(idx)].cents * qty;
    }, 0);
  }, [denominationCounts]);

  const bankDepositAmount = Math.max(0, countedCashTotal - pettyCashRemaining);
  const expectedCashFromMemberships = closure?.expectedCashFromMemberships ?? expectedCash?.expectedCashFromMemberships ?? 0;
  const expectedCashFromCourses = closure?.expectedCashFromCourses ?? expectedCash?.expectedCashFromCourses ?? 0;
  const totalExpenses = closure?.expensesTotal ?? expectedCash?.totalExpenses ?? 0;
  // Previous closure's leftover petty cash is physically already in the drawer,
  // so it is part of what we expect to count today.
  const previousPettyCash = closure?.previousPettyCash ?? expectedCash?.previousPettyCash ?? 0;
  const expectedTotal = previousPettyCash + expectedCashFromMemberships + expectedCashFromCourses - totalExpenses;
  const difference = countedCashTotal - expectedTotal;

  // Determine difference status
  const getDifferenceStatus = (diff: number) => {
    if (diff === 0) return { status: 'perfect', label: 'PERFETTO', color: '#c8e6c9', textColor: '#1b5e20' };
    if (diff > 0) return { status: 'excess', label: 'ESUBERO', color: '#fff3cd', textColor: '#856404' };
    return { status: 'shortage', label: 'AMMANCO', color: '#f8d7da', textColor: '#721c24' };
  };

  const diffStatus = getDifferenceStatus(difference);

  const handleDenomChange = (index: number, delta: number) => {
    setDenominationCounts((prev) => ({
      ...prev,
      [index]: Math.max(0, (prev[index] || 0) + delta),
    }));
  };

  const handleSave = async () => {
    if (!yearId) return;

    // Always ask for confirmation before saving
    let message = `Confermi di voler salvare questa chiusura di cassa?`;

    // Add warning if difference is not zero
    if (difference !== 0) {
      const differenceType = difference > 0 ? 'ESUBERO' : 'AMMANCO';
      const differenceAmount = centsToEuros(Math.abs(difference));
      message = `⚠️ ATTENZIONE: ${differenceType} di cassa di ${differenceAmount}.\n\n${message}`;
    }

    if (!window.confirm(message)) {
      return;
    }

    const denomData: CashClosingDenomination[] = DENOMINATIONS.map((denom, idx) => ({
      denominationCents: denom.cents,
      quantity: denominationCounts[idx] || 0,
      subtotal: (denominationCounts[idx] || 0) * denom.cents,
    }));

    const payload = {
      closureDate,
      academicYearId: yearId,
      countedCashTotal,
      pettyCashRemaining,
      bankDepositNumber: bankDepositNumber || undefined,
      bankDepositDate: bankDepositDate || undefined,
      notes: notes || undefined,
      denominationCounts: denomData,
    };

    try {
      if (closure) {
        await updateClosure.mutateAsync(payload);
      } else {
        await createClosure.mutateAsync(payload);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    }
  };

  const isLocked = !!lastClosureDate && new Date(closureDate) < new Date(lastClosureDate);

  const handleExportPDF = async () => {
    if (!closure) {
      alert('Nessuna chiusura di cassa da esportare');
      return;
    }
    try {
      window.open(`/api/cash-closings/${closure.id}/export/pdf`, '_blank');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore nell\'apertura PDF');
    }
  };

  const handleExportExcel = async () => {
    if (!closure) {
      alert('Nessuna chiusura di cassa da esportare');
      return;
    }
    try {
      const response = await fetch(`/api/cash-closings/${closure.id}/export/excel`);
      if (!response.ok) throw new Error('Errore nell\'esportazione');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chiusura_cassa_${closureDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore nell\'esportazione Excel');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8">
        <PageHeader title="Chiusura di Cassa Giornaliera" subtitle="Gestione della chiusura di cassa giornaliera" />

        {/* HEADER WITH DATE, YEAR, STATUS, BUTTONS */}
        <div className="card mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-4">💰 Chiusura di Cassa Giornaliera</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Chiusura</label>
                <input
                  type="date"
                  value={closureDate}
                  onChange={(e) => setClosureDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Anno Accademico</label>
                <div className="input bg-slate-100 text-slate-600">{activeYear?.label || 'N/A'}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span
              className="px-4 py-2 rounded-full font-semibold text-sm"
              style={{
                backgroundColor: closure ? '#f3e5f5' : '#e8f5e9',
                color: closure ? '#6a1b9a' : '#2e7d32',
              }}
            >
              {closure ? 'CHIUSA' : 'APERTA'}
            </span>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!!closure || isLocked} className="btn-primary disabled:opacity-50">
                💾 Salva
              </button>
              <button onClick={handleExportPDF} disabled={!closure} className="btn-secondary disabled:opacity-50">
                📄 PDF
              </button>
              <button onClick={handleExportExcel} disabled={!closure} className="btn-secondary disabled:opacity-50">
                📊 Excel
              </button>
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="mb-6 p-4 bg-orange-100 border-l-4 border-orange-500 text-orange-700 rounded">
            ⚠️ <strong>Data bloccata:</strong> Esiste una chiusura di cassa per questa data o precedente. Non è possibile modificare.
          </div>
        )}

        {/* MAIN 3-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* LEFT PANEL: EXPECTED CASH */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 pb-3 border-b-2 border-slate-200">📊 Contanti Attesi Oggi</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Fondo Cassa Precedente</span>
                <span className="font-semibold">+{centsToEuros(previousPettyCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Iscrizioni (contanti)</span>
                <span className="font-semibold">+{centsToEuros(expectedCashFromMemberships)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Corsi (contanti)</span>
                <span className="font-semibold">+{centsToEuros(expectedCashFromCourses)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Spese e differenze</span>
                <span className="font-semibold text-red-600">-{centsToEuros(totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-sm border-t-2 border-blue-500 pt-3 mt-3">
                <span className="font-semibold text-blue-600">TOTALE ATTESO</span>
                <span className="font-bold text-blue-600 text-lg">{centsToEuros(expectedTotal)}</span>
              </div>
            </div>
          </div>

          {/* CENTER PANEL: DENOMINATION COUNTING */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 pb-3 border-b-2 border-slate-200">💵 Conteggio Contanti Fisici</h3>
            <div className="space-y-0 border border-slate-300 rounded overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 bg-slate-100 border-b border-slate-300 text-sm font-semibold text-slate-700">
                <div className="p-3">Taglio</div>
                <div className="p-3 text-center">Quantità</div>
                <div className="p-3 text-right">Subtotale</div>
              </div>
              {/* Rows */}
              {DENOMINATIONS.map((denom, idx) => {
                const qty = denominationCounts[idx] || 0;
                const subtotal = qty * denom.cents;
                return (
                  <div key={idx} className="grid grid-cols-3 border-b border-slate-200 last:border-b-0 items-center">
                    <div className="p-3 text-sm font-medium text-slate-800">{denom.label}</div>
                    <div className="p-2 flex justify-center gap-1">
                      <button
                        onClick={() => handleDenomChange(idx, -1)}
                        className="w-8 h-8 border border-slate-300 rounded hover:bg-slate-100 font-semibold"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) =>
                          setDenominationCounts((prev) => ({
                            ...prev,
                            [idx]: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                        className="w-12 border border-slate-300 rounded text-center text-sm font-semibold"
                      />
                      <button
                        onClick={() => handleDenomChange(idx, 1)}
                        className="w-8 h-8 border border-slate-300 rounded hover:bg-slate-100 font-semibold"
                      >
                        +
                      </button>
                    </div>
                    <div className="p-3 text-right text-sm font-semibold text-slate-800">{centsToEuros(subtotal)}</div>
                  </div>
                );
              })}
              {/* Total Row */}
              <div className="grid grid-cols-3 bg-slate-50 border-t-2 border-blue-500 font-bold items-center">
                <div className="p-3 text-blue-600">TOTALE RILEVATO</div>
                <div></div>
                <div className="p-3 text-right text-blue-600 text-lg">{centsToEuros(countedCashTotal)}</div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: ALLOCATION & DIFFERENCE */}
          <div className="card">
            <h3 className="text-lg font-bold mb-4 pb-3 border-b-2 border-slate-200">🏦 Allocazione</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 uppercase text-xs mb-3 block">Destinazione Contanti</label>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Fondo Cassa Restante</span>
                    <input
                      type="number"
                      step="1"
                      value={pettyCashFocused ? (pettyCashRemaining / 100).toString() : (pettyCashRemaining / 100).toFixed(2)}
                      onChange={(e) => setPettyCashRemaining(Math.max(0, parseFloat(e.target.value) || 0) * 100)}
                      onFocus={() => setPettyCashFocused(true)}
                      onBlur={() => setPettyCashFocused(false)}
                      className="input w-32 text-right"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Versamento Banca</span>
                    <span className="font-semibold w-32 text-right pr-3">{centsToEuros(bankDepositAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Difference Box */}
              <div className="border-t-2 border-slate-200 pt-4 mt-4 text-center">
                <div className="text-sm text-slate-600 mb-2">Differenza di Cassa</div>
                <div className="text-4xl font-bold mb-3" style={{ color: diffStatus.textColor }}>
                  {centsToEuros(difference)}
                </div>
                <span
                  className="inline-block px-4 py-2 rounded text-sm font-semibold"
                  style={{ backgroundColor: diffStatus.color, color: diffStatus.textColor }}
                >
                  {diffStatus.label}
                </span>
              </div>

              {/* Bank Deposit Details */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 mt-4">
                <label className="text-xs font-semibold text-slate-700 uppercase block mb-2">Dettagli Versamento Banca</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Numero versamento"
                    value={bankDepositNumber}
                    onChange={(e) => setBankDepositNumber(e.target.value)}
                    className="input text-sm w-full"
                  />
                  <input
                    type="date"
                    value={bankDepositDate}
                    onChange={(e) => setBankDepositDate(e.target.value)}
                    className="input text-sm w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NOTES SECTION */}
        <div className="card mb-6">
          <h3 className="text-lg font-bold mb-4">📝 Note</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aggiungi note sulla chiusura di cassa..."
            rows={4}
            className="input w-full"
          />
        </div>

        {/* HISTORY SECTION */}
        {history && history.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-bold mb-4">📋 Storico Chiusure Precedenti</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-right">Contanti Attesi</th>
                    <th className="px-4 py-2 text-right">Contanti Rilevati</th>
                    <th className="px-4 py-2 text-right">Differenza</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-2">{formatDate(h.closureDate)}</td>
                      <td className="px-4 py-2 text-right">{centsToEuros(h.previousPettyCash + h.expectedCashFromMemberships + h.expectedCashFromCourses - h.expensesTotal)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{centsToEuros(h.countedCashTotal)}</td>
                      <td className="px-4 py-2 text-right">
                        <span
                          style={{
                            color: h.difference === 0 ? '#1b5e20' : h.difference > 0 ? '#856404' : '#721c24',
                          }}
                        >
                          {centsToEuros(h.difference)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-8 py-4 text-center text-sm text-slate-600">
        <div>
          Copyright © Unisaperi - Università dei Saperi Giulio Grimaldi<br />
          Via Arco d'Augusto, 81 (ex tribunale) primo piano | 61032 Fano (PU) | CF 90025870412
        </div>
        <div className="mt-2 text-slate-500">
          Powered by Pejo61
        </div>
      </footer>
    </div>
  );
}
