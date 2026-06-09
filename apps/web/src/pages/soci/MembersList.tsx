import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { InputField, SelectField } from '../../components/Field';
import { useCategories } from '../../hooks/useCategories';
import { useMembers, type MembersFilter } from '../../hooks/useMembers';
import { useCurrentAcademicYear } from '../../hooks/useAcademicYears';
import type { MembershipStatus, MembershipType } from '../../types';

function membershipTone(status: MembershipStatus) {
  switch (status) {
    case 'APPROVATA':
      return 'green';
    case 'IN_ATTESA':
      return 'amber';
    case 'RIFIUTATA':
    case 'ANNULLATA':
      return 'red';
  }
}

export function MembersListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');
  const [importOpen, setImportOpen] = useState(false);

  const sortBy = searchParams.get('sortBy') ?? 'cognome';
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc';

  const filter: MembersFilter = {
    q: searchParams.get('q') ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    membershipType: (searchParams.get('membershipType') as MembershipType) || undefined,
    membershipStatus: (searchParams.get('membershipStatus') as MembershipStatus) || undefined,
    noMembership: searchParams.get('noMembership') === 'true',
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: 25,
    sortBy: (searchParams.get('sortBy') as 'cognome' | 'createdAt') || 'cognome',
    sortDir: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
  };

  const { data: categories } = useCategories();
  const { data: currentYear } = useCurrentAcademicYear();
  const { data, isLoading, isError, error } = useMembers(filter);

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

  function resetFilters() {
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

  return (
    <div className="p-8">
      <PageHeader
        title="Soci"
        subtitle={
          currentYear
            ? `Anno accademico in corso: ${currentYear.label}`
            : 'Nessun anno accademico attivo'
        }
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => setImportOpen(true)}
              title="Importa soci da file Excel"
            >
              Importa Excel
            </button>
            <a
              href={`/api/members/export.xlsx?${searchParams.toString()}`}
              className="btn-secondary"
              title="Esporta lista soci in Excel (rispetta i filtri attivi)"
              download
            >
              Esporta Excel
            </a>
            <Link to="/soci/nuovo" className="btn-primary">
              + Nuovo socio
            </Link>
          </>
        }
      />

      <div className="card mb-4">
        <form onSubmit={onSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <InputField
            label="Cerca"
            placeholder="Cognome, nome, CF, email…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="md:col-span-2"
          />
          <SelectField
            label="Categoria"
            value={filter.categoryId ?? ''}
            onChange={(e) => updateFilter({ categoryId: e.target.value || undefined })}
          >
            <option value="">Tutte</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Iscrizione anno"
            value={
              filter.noMembership
                ? 'NONE'
                : filter.membershipStatus ?? filter.membershipType ?? ''
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') {
                updateFilter({
                  membershipStatus: undefined,
                  membershipType: undefined,
                  noMembership: undefined,
                });
              } else if (v === 'NONE') {
                updateFilter({
                  noMembership: 'true',
                  membershipStatus: undefined,
                  membershipType: undefined,
                });
              } else if (v === 'NUOVA' || v === 'RINNOVO') {
                updateFilter({
                  membershipType: v,
                  membershipStatus: undefined,
                  noMembership: undefined,
                });
              } else {
                updateFilter({
                  membershipStatus: v,
                  membershipType: undefined,
                  noMembership: undefined,
                });
              }
            }}
          >
            <option value="">Tutte</option>
            <option value="NONE">Senza iscrizione</option>
            <option value="NUOVA">Tipo: nuova</option>
            <option value="RINNOVO">Tipo: rinnovo</option>
            <option value="IN_ATTESA">Stato: in attesa</option>
            <option value="APPROVATA">Stato: approvata</option>
            <option value="RIFIUTATA">Stato: rifiutata</option>
          </SelectField>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">
              Cerca
            </button>
            <button type="button" className="btn-secondary" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Caricamento…</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600">
            {error instanceof Error ? error.message : 'Errore caricamento'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('cognome')}
                  title="Clicca per ordinare"
                >
                  Cognome e nome{renderSortIcon('cognome')}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('codiceFiscale')}
                  title="Clicca per ordinare"
                >
                  Codice fiscale{renderSortIcon('codiceFiscale')}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('category')}
                  title="Clicca per ordinare"
                >
                  Categoria{renderSortIcon('category')}
                </th>
                <th className="text-left px-4 py-3 font-medium">Iscrizione anno</th>
                <th className="text-left px-4 py-3 font-medium">Contatti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nessun socio trovato con questi filtri.
                  </td>
                </tr>
              ) : (
                data?.items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/soci/${m.id}`} className="text-brand-700 hover:underline">
                        {m.cognome} {m.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {m.codiceFiscale ?? '—'}
                    </td>
                    <td className="px-4 py-3">{m.category.name}</td>
                    <td className="px-4 py-3">
                      {m.currentMembership ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone="blue">{m.currentMembership.type}</Badge>
                          <Badge tone={membershipTone(m.currentMembership.status)}>
                            {m.currentMembership.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[m.email, m.telefono, m.cellulare].filter(Boolean).join(' · ') || '—'}
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

      <ImportModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  total: number;
  errors: string[];
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function handleImport() {
    if (!file) {
      setErr('Seleziona un file');
      return;
    }

    setLoading(true);
    setErr(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/members/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante import');
      }

      const data = await response.json() as ImportResult;
      setResult(data);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity ${
        open ? 'bg-opacity-50' : 'pointer-events-none bg-opacity-0'
      }`}
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Importa soci da Excel</h2>

        {!result ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Seleziona file Excel
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
                disabled={loading}
              />
            </div>

            {file && <p className="text-xs text-slate-500 mb-4">File: {file.name}</p>}

            {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Annulla
              </button>
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={!file || loading}
              >
                {loading ? 'Importazione…' : 'Importa'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 mb-4 text-sm">
              <p>
                <span className="text-slate-500">Creati:</span>{' '}
                <span className="font-medium text-emerald-700">{result.created}</span>
              </p>
              <p>
                <span className="text-slate-500">Aggiornati:</span>{' '}
                <span className="font-medium text-blue-700">{result.updated}</span>
              </p>
              <p>
                <span className="text-slate-500">Totale:</span>{' '}
                <span className="font-medium">{result.total}</span>
              </p>
              {result.errors.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 max-h-32 overflow-y-auto text-xs">
                  <p className="font-medium mb-1">Errori ({result.errors.length}):</p>
                  <ul className="space-y-1">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                    {result.errors.length > 5 && <li>... e {result.errors.length - 5} altri</li>}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button className="btn-primary" onClick={onClose}>
                Chiudi
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
