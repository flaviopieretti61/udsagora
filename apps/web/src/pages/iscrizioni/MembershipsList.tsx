import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { InputField, SelectField } from '../../components/Field';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import {
  useApproveMembership,
  useCancelMembership,
  useDeleteMembership,
  useMemberships,
  type MembershipsFilter,
} from '../../hooks/useMemberships';
import { useAuth } from '../../auth/AuthContext';
import { formatCents, formatDate } from '../../lib/format';
import type { MembershipListItem, MembershipStatus, MembershipType } from '../../types';
import { RejectModal } from './RejectModal';
import { statusLabel, statusTone } from './helpers';

export function MembershipsListPage() {
  const { user } = useAuth();
  const isConsiglio = user?.role === 'ADMIN' || user?.role === 'CONSIGLIO';
  const { data: years } = useAcademicYears();
  const activeYear = years?.find((y) => y.active);

  const [searchParams, setSearchParams] = useSearchParams();
  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');

  const sortBy = searchParams.get('sortBy') ?? 'member';
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc';

  const filter: MembershipsFilter = {
    status: (searchParams.get('status') as MembershipStatus) || undefined,
    type: (searchParams.get('type') as MembershipType) || undefined,
    academicYearId: searchParams.get('academicYearId') ?? activeYear?.id,
    q: searchParams.get('q') ?? undefined,
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: 25,
    sortBy: (searchParams.get('sortBy') as 'member' | 'year' | 'type' | 'status') || 'member',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
  };

  const { data, isLoading, isError, error } = useMemberships(filter);
  const approve = useApproveMembership();
  const cancel = useCancelMembership();
  const del = useDeleteMembership();

  const [rejectFor, setRejectFor] = useState<MembershipListItem | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  function updateFilter(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.set('page', '1');
    setSearchParams(next, { replace: true });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateFilter({ q: qInput.trim() || undefined });
  }

  function reset() {
    setQInput('');
    setSearchParams({}, { replace: true });
  }

  function handleSort(column: string) {
    const nextOrder =
      sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    updateFilter({ sortBy: column, sortOrder: nextOrder });
  }

  function renderSortIcon(column: string) {
    if (sortBy !== column) return ' ▼';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  }

  async function doApprove(m: MembershipListItem) {
    setActionErr(null);
    try {
      await approve.mutateAsync(m.id);
    } catch (ex) {
      setActionErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function doCancel(m: MembershipListItem) {
    if (!confirm(`Annullare l'iscrizione di ${m.member.cognome} ${m.member.nome}?`)) return;
    setActionErr(null);
    try {
      await cancel.mutateAsync(m.id);
    } catch (ex) {
      setActionErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function doDelete(m: MembershipListItem) {
    if (!confirm("Eliminare l'iscrizione in attesa? Operazione irreversibile.")) return;
    setActionErr(null);
    try {
      await del.mutateAsync(m.id);
    } catch (ex) {
      setActionErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Iscrizioni e rinnovi"
        subtitle={
          filter.academicYearId
            ? `Anno: ${years?.find((y) => y.id === filter.academicYearId)?.label ?? '?'}`
            : 'Tutti gli anni'
        }
      />

      <div className="card mb-4">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <InputField
            label="Cerca socio"
            placeholder="Cognome, nome, CF…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <SelectField
            label="Anno"
            value={filter.academicYearId ?? ''}
            onChange={(e) => updateFilter({ academicYearId: e.target.value || undefined })}
          >
            <option value="">Tutti</option>
            {years?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Tipo"
            value={filter.type ?? ''}
            onChange={(e) => updateFilter({ type: e.target.value || undefined })}
          >
            <option value="">Tutti</option>
            <option value="NUOVA">Nuova</option>
            <option value="RINNOVO">Rinnovo</option>
          </SelectField>
          <SelectField
            label="Stato"
            value={filter.status ?? ''}
            onChange={(e) => updateFilter({ status: e.target.value || undefined })}
          >
            <option value="">Tutti</option>
            <option value="IN_ATTESA">In attesa</option>
            <option value="APPROVATA">Approvata</option>
            <option value="RIFIUTATA">Rifiutata</option>
            <option value="ANNULLATA">Annullata</option>
          </SelectField>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">
              Cerca
            </button>
            <button type="button" className="btn-secondary" onClick={reset}>
              Reset
            </button>
          </div>
        </form>
      </div>

      {actionErr && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {actionErr}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Caricamento…</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600">
            {error instanceof Error ? error.message : 'Errore'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('member')}
                  title="Clicca per ordinare"
                >
                  Socio{renderSortIcon('member')}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('year')}
                  title="Clicca per ordinare"
                >
                  Anno{renderSortIcon('year')}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('type')}
                  title="Clicca per ordinare"
                >
                  Tipo{renderSortIcon('type')}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('status')}
                  title="Clicca per ordinare"
                >
                  Stato{renderSortIcon('status')}
                </th>
                <th className="text-right px-4 py-3 font-medium">Dovuto</th>
                <th className="text-right px-4 py-3 font-medium">Pagato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Nessuna iscrizione trovata.
                  </td>
                </tr>
              ) : (
                data?.items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3">
                      <Link
                        to={`/soci/${m.member.id}`}
                        className="text-brand-700 hover:underline font-medium"
                      >
                        {m.member.cognome} {m.member.nome}
                      </Link>
                      <div className="text-xs text-slate-500">{m.member.category.name}</div>
                    </td>
                    <td className="px-4 py-3">{m.academicYear.label}</td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{m.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
                      {m.status === 'RIFIUTATA' && m.rejectionReason && (
                        <div className="text-xs text-slate-500 mt-1">{m.rejectionReason}</div>
                      )}
                      {(m.status === 'APPROVATA' || m.status === 'ANNULLATA' || m.status === 'RIFIUTATA') && m.approvedAt && (
                        <div className="text-xs text-slate-500 mt-1">
                          {m.status === 'ANNULLATA' && 'Annullato: '}
                          {m.status === 'RIFIUTATA' && 'Rifiutato: '}
                          {m.status === 'APPROVATA' && 'da '}
                          {m.approvedBy && `${m.approvedBy.fullName} il `}
                          {formatDate(m.approvedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCents(m.amountDueCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCents(m.amountPaidCents)}
                      {m.paymentDate && (
                        <div className="text-xs text-slate-500">{formatDate(m.paymentDate)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm space-x-2 whitespace-nowrap">
                      {m.status === 'IN_ATTESA' && isConsiglio && (
                        <>
                          <button
                            className="text-emerald-700 hover:underline"
                            onClick={() => doApprove(m)}
                          >
                            Approva
                          </button>
                          <button
                            className="text-red-600 hover:underline"
                            onClick={() => setRejectFor(m)}
                          >
                            Rifiuta
                          </button>
                        </>
                      )}
                      {(m.status === 'IN_ATTESA' || m.status === 'APPROVATA') && (
                        <button
                          className="text-slate-600 hover:underline"
                          onClick={() => doCancel(m)}
                        >
                          Annulla
                        </button>
                      )}
                      {m.status === 'IN_ATTESA' && (
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => doDelete(m)}
                          title="Elimina iscrizione in attesa (errore di inserimento)"
                        >
                          Elimina
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="mt-4">
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => updateFilter({ page: String(p) })}
          />
        </div>
      )}

      <RejectModal
        open={!!rejectFor}
        membershipId={rejectFor?.id ?? null}
        onClose={() => setRejectFor(null)}
      />
    </div>
  );
}
