import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { SelectField } from '../../components/Field';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { useRevenueReport, useEnrollmentsDetailReport } from '../../hooks/useReports';
import { formatCents, formatDate } from '../../lib/format';

export function ReportsPage() {
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const activeYear = years?.find((y) => y.active);
  const [activeTab, setActiveTab] = useState<'revenue' | 'enrollments'>('revenue');

  if (yearsLoading) {
    return (
      <div className="p-8">
        <PageHeader title="Report" subtitle="Analisi dati" />
        <div className="card text-slate-500">Caricamento anni accademici…</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="Report" subtitle="Analisi dati" />
      <div className="card mb-4">
        <SelectField
          label="Anno accademico"
          value={activeYear?.id ?? ''}
          disabled
          className="max-w-xs"
        >
          {years?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.active ? ' (attivo)' : ''}
            </option>
          ))}
        </SelectField>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('revenue')}
          className={clsx(
            'px-4 py-2 font-medium text-sm transition',
            activeTab === 'revenue'
              ? 'text-brand-700 border-b-2 border-brand-700'
              : 'text-slate-600 hover:text-slate-800',
          )}
        >
          Riepilogo Incassi
        </button>
        <button
          onClick={() => setActiveTab('enrollments')}
          className={clsx(
            'px-4 py-2 font-medium text-sm transition',
            activeTab === 'enrollments'
              ? 'text-brand-700 border-b-2 border-brand-700'
              : 'text-slate-600 hover:text-slate-800',
          )}
        >
          Dettaglio Iscrizioni
        </button>
      </div>

      {activeTab === 'revenue' && <RevenuePanel academicYearId={activeYear?.id} />}
      {activeTab === 'enrollments' && <EnrollmentsDetailPanel academicYearId={activeYear?.id} />}
    </div>
  );
}

function RevenuePanel({ academicYearId }: { academicYearId?: string }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState<string>(today);
  const [dateTo, setDateTo] = useState<string>(today);
  const { data, isLoading, refetch } = useRevenueReport(
    academicYearId,
    dateFrom || undefined,
    dateTo || undefined,
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reports', 'revenue'] });
    refetch();
  };

  function getPdfDownloadUrl(): string {
    const params = new URLSearchParams();
    if (academicYearId) params.append('academicYearId', academicYearId);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return `/api/reports/revenue.pdf${params.toString() ? '?' + params.toString() : ''}`;
  }

  if (isLoading) return <div className="p-8 text-slate-500">Caricamento…</div>;
  if (!data || !data.academicYear) {
    return (
      <div className="card text-sm text-slate-500">
        Nessun anno accademico attivo. Configuralo in Configurazione.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <PageHeader
          title="Riepilogo Incassi"
          actions={
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="btn-secondary disabled:opacity-50"
                title="Aggiorna i dati del report"
              >
                {isLoading ? 'Aggiornamento...' : '↻ Refresh'}
              </button>
              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                title="Stampa report in PDF"
              >
                Stampa (PDF)
              </a>
            </div>
          }
        />
      </div>

      <div className="card p-4 flex gap-4 items-end flex-1">
        <div className="flex gap-4 items-end flex-1">
          <div className="flex-1">
            <label className="label text-xs">Data da</label>
            <input
              type="date"
              className="input w-full"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="label text-xs">Data a</label>
            <input
              type="date"
              className="input w-full"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card label="Incassato totale" value={formatCents(data.totals?.grandPaidCents ?? 0)} />
        <Card label="Dovuto totale" value={formatCents(data.totals?.grandDueCents ?? 0)} />
      </div>

      <section className="card overflow-hidden p-0">
        <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
          Tessere (per categoria)
        </header>
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Categoria</th>
              <th className="text-right px-4 py-2 font-medium">Tessere</th>
              <th className="text-right px-4 py-2 font-medium">Dovuto</th>
              <th className="text-right px-4 py-2 font-medium">Pagato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.memberships.length === 0 && data.pendingMemberships.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nessuna tessera.
                </td>
              </tr>
            ) : (
              <>
                {data.memberships.map((m) => (
                  <tr key={`approved-${m.categoryId}`}>
                    <td className="px-4 py-2">{m.categoryName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCents(m.dueCents)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCents(m.paidCents)}
                    </td>
                  </tr>
                ))}
                {data.pendingMemberships.map((m) => (
                  <tr key={`pending-${m.categoryId}`} className="bg-amber-50">
                    <td className="px-4 py-2">
                      {m.categoryName}
                      <div className="text-xs text-amber-700">In attesa di approvazione</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCents(m.dueCents)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCents(m.paidCents)}
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot className="bg-slate-50 text-slate-700">
            <tr>
              <td className="px-4 py-2 font-medium">Totale</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {(data.memberships ?? []).reduce((a, b) => a + b.count, 0) +
                  (data.pendingMemberships ?? []).reduce((a, b) => a + b.count, 0)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCents(
                  (data.totals?.membershipsDueCents ?? 0) + (data.totals?.pendingMembershipsDueCents ?? 0)
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCents(
                  (data.totals?.membershipsPaidCents ?? 0) + (data.totals?.pendingMembershipsPaidCents ?? 0)
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="card overflow-hidden p-0">
        <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
          Corsi
        </header>
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Corso</th>
              <th className="text-left px-4 py-2 font-medium">Stato</th>
              <th className="text-right px-4 py-2 font-medium">Iscritti</th>
              <th className="text-right px-4 py-2 font-medium">Dovuto</th>
              <th className="text-right px-4 py-2 font-medium">Pagato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nessun corso per questo anno.
                </td>
              </tr>
            ) : (
              data.courses.map((c) => (
                <tr key={c.courseId}>
                  <td className="px-4 py-2">
                    <Link to={`/corsi/${c.courseId}`} className="text-brand-700 hover:underline">
                      {c.titolo}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge>{c.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCents(c.dueCents)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCents(c.paidCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50 text-slate-700">
            <tr>
              <td className="px-4 py-2 font-medium" colSpan={2}>
                Totale
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {data.courses.reduce((a, b) => a + b.count, 0)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCents(data.totals?.coursesDueCents ?? 0)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatCents(data.totals?.coursesPaidCents ?? 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="card overflow-hidden p-0">
        <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
          Incassi per metodo di pagamento
        </header>
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Metodo</th>
              <th className="text-right px-4 py-2 font-medium">Importo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.byPaymentMethod.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                  Nessun incasso registrato.
                </td>
              </tr>
            ) : (
              data.byPaymentMethod.map((m) => (
                <tr key={m.method}>
                  <td className="px-4 py-2">{m.method}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCents(m.totalCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {(data.canceledEnrollments.length > 0 || (data.expenses && data.expenses.length > 0)) && (
        <section className="card overflow-hidden p-0">
          <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
            Annullamenti, Rimborsi, Spese, Differenze
          </header>
          <table className="w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Descrizione</th>
                <th className="text-right px-4 py-2 font-medium">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.canceledEnrollments.length === 0 && (!data.expenses || data.expenses.length === 0) ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                    Nessun annullamento, rimborso o spesa registrato.
                  </td>
                </tr>
              ) : (
                <>
                  {data.canceledEnrollments.map((c) => (
                    <tr key={`refund-${c.method}`}>
                      <td className="px-4 py-2">Rimborso: {c.method}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600">
                        − {formatCents(c.refundCents)}
                      </td>
                    </tr>
                  ))}
                  {data.expenses?.map((e: { expenseDate: string; description: string; amountCents: number }, idx: number) => (
                    <tr key={`expense-${idx}`}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{e.description}</div>
                        <div className="text-xs text-slate-500">{formatDate(e.expenseDate)}</div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600">
                        − {formatCents(e.amountCents)}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function EnrollmentsDetailPanel({ academicYearId }: { academicYearId?: string }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState<string>(today);
  const [dateTo, setDateTo] = useState<string>(today);
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useEnrollmentsDetailReport(
    academicYearId,
    dateFrom || undefined,
    dateTo || undefined,
    page,
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reports', 'enrollments-detail'] });
    refetch();
  };

  function getPdfDownloadUrl(): string {
    const params = new URLSearchParams();
    if (academicYearId) params.append('academicYearId', academicYearId);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return `/api/reports/enrollments-detail.pdf${params.toString() ? '?' + params.toString() : ''}`;
  }

  function getXlsxDownloadUrl(): string {
    const params = new URLSearchParams();
    if (academicYearId) params.append('academicYearId', academicYearId);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return `/api/reports/enrollments-detail.xlsx${params.toString() ? '?' + params.toString() : ''}`;
  }

  if (isLoading) return <div className="p-8 text-slate-500">Caricamento…</div>;
  if (!data || !data.academicYear) {
    return (
      <div className="card text-sm text-slate-500">
        Nessun anno accademico attivo. Configuralo in Configurazione.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 justify-between items-center">
        <PageHeader
          title="Dettaglio Iscrizioni"
          actions={
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="btn-secondary disabled:opacity-50"
                title="Aggiorna i dati del report"
              >
                {isLoading ? 'Aggiornamento...' : '↻ Refresh'}
              </button>
              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                title="Stampa report in PDF"
              >
                Stampa (PDF)
              </a>
              <a
                href={getXlsxDownloadUrl()}
                className="btn-secondary"
                title="Esporta report in Excel"
              >
                Esporta (Excel)
              </a>
            </div>
          }
        />
      </div>

      <div className="card p-4 flex gap-4 items-end flex-1">
        <div className="flex gap-4 items-end flex-1">
          <div className="flex-1">
            <label className="label text-xs">Data da</label>
            <input
              type="date"
              className="input w-full"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="label text-xs">Data a</label>
            <input
              type="date"
              className="input w-full"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Sezione 1: Tessere */}
      <section className="card overflow-hidden p-0">
        <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
          Sezione 1: Iscrizioni Tessere ({data.membershipsPagination.total})
        </header>
        <table className="w-full text-sm">
          <thead className="text-slate-500 bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Cognome</th>
              <th className="text-left px-4 py-2 font-medium">Nome</th>
              <th className="text-left px-4 py-2 font-medium">Data</th>
              <th className="text-left px-4 py-2 font-medium">Tipo</th>
              <th className="text-left px-4 py-2 font-medium">Stato</th>
              <th className="text-right px-4 py-2 font-medium">Dovuto</th>
              <th className="text-right px-4 py-2 font-medium">Pagato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.memberships.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Nessuna tessera per questo periodo.
                </td>
              </tr>
            ) : (
              data.memberships.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{m.member.cognome}</td>
                  <td className="px-4 py-2">{m.member.nome}</td>
                  <td className="px-4 py-2 text-sm text-slate-600">{formatDate(m.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Badge tone="blue">{m.type}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCents(m.amountDueCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCents(m.amountPaidCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data.membershipsPagination.total > 50 && (
          <div className="p-3 bg-slate-50 border-t flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              ← Prec
            </button>
            <span className="px-3 py-1 text-sm">
              Pag {page} di{' '}
              {Math.ceil(data.membershipsPagination.total / data.membershipsPagination.pageSize)}
            </span>
            <button
              onClick={() =>
                setPage(
                  Math.min(
                    Math.ceil(data.membershipsPagination.total / data.membershipsPagination.pageSize),
                    page + 1,
                  ),
                )
              }
              disabled={
                page ===
                Math.ceil(data.membershipsPagination.total / data.membershipsPagination.pageSize)
              }
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Succ →
            </button>
          </div>
        )}

        {/* Sommario tessere */}
        <div className="p-4 bg-slate-50 border-t">
          <h4 className="font-semibold text-slate-700 mb-2 text-sm">Riepilogo Tessere</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-600">
                <th className="text-left px-2 py-1">Tipo</th>
                <th className="text-left px-2 py-1">Stato</th>
                <th className="text-left px-2 py-1">Metodo</th>
                <th className="text-right px-2 py-1">Count</th>
                <th className="text-right px-2 py-1">Dovuto</th>
                <th className="text-right px-2 py-1">Pagato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.membershipsSummary.map((s, idx) => (
                <tr key={idx} className="text-slate-700">
                  <td className="px-2 py-1">{s.type}</td>
                  <td className="px-2 py-1">{s.status}</td>
                  <td className="px-2 py-1">{s.paymentMethod || '-'}</td>
                  <td className="text-right px-2 py-1">{s.count}</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(s.totalDueCents)}</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(s.totalPaidCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sezione 2: Corsi */}
      <section className="card overflow-hidden p-0">
        <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
          Sezione 2: Iscrizioni ai Corsi ({data.courseEnrollmentsPagination.total})
        </header>
        <table className="w-full text-sm">
          <thead className="text-slate-500 bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Cognome</th>
              <th className="text-left px-4 py-2 font-medium">Nome</th>
              <th className="text-left px-4 py-2 font-medium">Corso</th>
              <th className="text-left px-4 py-2 font-medium">Data</th>
              <th className="text-left px-4 py-2 font-medium">Stato</th>
              <th className="text-right px-4 py-2 font-medium">Dovuto</th>
              <th className="text-right px-4 py-2 font-medium">Pagato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.courseEnrollments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Nessuna iscrizione a corsi per questo periodo.
                </td>
              </tr>
            ) : (
              data.courseEnrollments.map((e, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{e.member.cognome}</td>
                  <td className="px-4 py-2">{e.member.nome}</td>
                  <td className="px-4 py-2 text-sm">{e.course.titolo.substring(0, 30)}</td>
                  <td className="px-4 py-2 text-sm text-slate-600">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={e.status === 'ATTIVA' ? 'green' : 'red'}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCents(e.amountDueCents)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCents(e.amountPaidCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Sommario corsi */}
        <div className="p-4 bg-slate-50 border-t">
          <h4 className="font-semibold text-slate-700 mb-2 text-sm">Riepilogo Corsi</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-600">
                <th className="text-left px-2 py-1">Metodo</th>
                <th className="text-right px-2 py-1">Count</th>
                <th className="text-right px-2 py-1">Dovuto</th>
                <th className="text-right px-2 py-1">Pagato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.courseEnrollmentsSummary.map((s, idx) => (
                <tr key={idx} className="text-slate-700">
                  <td className="px-2 py-1">{s.paymentMethod || '-'}</td>
                  <td className="text-right px-2 py-1">{s.count}</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(s.totalDueCents)}</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(s.totalPaidCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sezione 3: Riepilogo Incassi */}
      <section className="card overflow-hidden p-0">
        <header className="bg-slate-50 px-4 py-2 font-medium text-slate-700 border-b border-slate-200">
          Sezione 3: Riepilogo Incassi
        </header>
        <div className="p-4 space-y-4">
          {data.byPaymentMethod.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-2 text-sm">Incassi per Metodo</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-600 text-xs">
                    <th className="text-left py-1">Metodo</th>
                    <th className="text-right py-1">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.byPaymentMethod.map((m, idx) => (
                    <tr key={idx} className="text-slate-700">
                      <td className="py-1">{m.method}</td>
                      <td className="text-right py-1 tabular-nums font-medium">{formatCents(m.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(data.canceledEnrollments.length > 0 || (data.expenses && data.expenses.length > 0)) && (
            <div>
              <h4 className="font-semibold text-slate-700 mb-2 text-sm text-red-700">Annullamenti, Rimborsi, Spese, Differenze</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-600 text-xs">
                    <th className="text-left py-1">Descrizione</th>
                    <th className="text-right py-1">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.canceledEnrollments.map((c, idx) => (
                    <tr key={`refund-${idx}`} className="text-slate-700">
                      <td className="py-1">Rimborso: {c.method}</td>
                      <td className="text-right py-1 tabular-nums font-medium text-red-600">
                        − {formatCents(c.refundCents)}
                      </td>
                    </tr>
                  ))}
                  {data.expenses?.map((e: { expenseDate: string; description: string; amountCents: number }, idx: number) => (
                    <tr key={`expense-${idx}`} className="text-slate-700">
                      <td className="py-1">
                        <div>{e.description}</div>
                        <div className="text-xs text-slate-500">{formatDate(e.expenseDate)}</div>
                      </td>
                      <td className="text-right py-1 tabular-nums font-medium text-red-600">
                        − {formatCents(e.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-3">
            <h4 className="font-semibold text-slate-700 mb-2 text-sm">Totali</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-600 text-xs">
                  <th className="text-left px-2 py-1">Categoria</th>
                  <th className="text-right px-2 py-1">Dovuto</th>
                  <th className="text-right px-2 py-1">Pagato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="text-slate-700">
                  <td className="px-2 py-1">Tessere</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(data.totals.membershipsDueCents)}</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(data.totals.membershipsPaidCents)}</td>
                </tr>
                <tr className="text-slate-700">
                  <td className="px-2 py-1">Corsi</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(data.totals.courseEnrollmentsDueCents)}</td>
                  <td className="text-right px-2 py-1 tabular-nums">{formatCents(data.totals.courseEnrollmentsPaidCents)}</td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-100 font-semibold text-brand-700">
                <tr>
                  <td className="px-2 py-2">Grand Total Pagato</td>
                  <td className="text-right px-2 py-2 tabular-nums"></td>
                  <td className="text-right px-2 py-2 tabular-nums text-lg">{formatCents(data.totals.grandPaidCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className={clsx('card', accent === 'amber' && 'border-amber-300')}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
