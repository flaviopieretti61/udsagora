import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { InputField, SelectField } from '../../components/Field';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { useCourses, type CoursesFilter } from '../../hooks/useCourses';
import { useAuth } from '../../auth/AuthContext';
import { formatCents, formatDate } from '../../lib/format';
import type { CourseStatus } from '../../types';

function statusTone(s: CourseStatus): 'green' | 'amber' | 'red' | 'slate' {
  switch (s) {
    case 'APERTO':
      return 'green';
    case 'IN_PREPARAZIONE':
      return 'amber';
    case 'CHIUSO':
      return 'slate';
    case 'ANNULLATO':
      return 'red';
  }
}

export function CoursesListPage() {
  const { user } = useAuth();
  const { data: years } = useAcademicYears();
  const activeYear = years?.find((y) => y.active);
  const [searchParams, setSearchParams] = useSearchParams();
  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');
  const [importOpen, setImportOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const sortBy = searchParams.get('sortBy') ?? 'titolo';
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc';

  const filter: CoursesFilter = {
    academicYearId: searchParams.get('academicYearId') ?? activeYear?.id,
    status: (searchParams.get('status') as CourseStatus) || undefined,
    q: searchParams.get('q') ?? undefined,
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: 25,
    sortBy: (searchParams.get('sortBy') as 'titolo' | 'year' | 'dataInizio' | 'status') || 'titolo',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
  };

  const { data, isLoading } = useCourses(filter);

  function updateFilter(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.set('page', '1');
    setSearchParams(next, { replace: true });
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
        title="Corsi"
        subtitle={
          filter.academicYearId
            ? `Anno: ${years?.find((y) => y.id === filter.academicYearId)?.label ?? '?'}`
            : 'Tutti gli anni'
        }
        actions={
          <>
            {isAdmin && (
              <button
                className="btn-secondary"
                onClick={() => setImportOpen(true)}
                title="Importa corsi da file Excel"
              >
                Importa Excel
              </button>
            )}
            {isAdmin && (
              <Link to="/corsi/nuovo" className="btn-primary">
                + Nuovo corso
              </Link>
            )}
          </>
        }
      />

      <div className="card mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateFilter({ q: qInput.trim() || undefined });
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <InputField
            label="Cerca"
            placeholder="Titolo, codice, docente…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <SelectField
            label="Anno accademico"
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
            label="Stato"
            value={filter.status ?? ''}
            onChange={(e) => updateFilter({ status: e.target.value || undefined })}
          >
            <option value="">Tutti</option>
            <option value="IN_PREPARAZIONE">In preparazione</option>
            <option value="APERTO">Aperto</option>
            <option value="CHIUSO">Chiuso</option>
            <option value="ANNULLATO">Annullato</option>
          </SelectField>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">
              Cerca
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setQInput('');
                setSearchParams({}, { replace: true });
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Caricamento…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('titolo')}
                  title="Clicca per ordinare"
                >
                  Titolo{renderSortIcon('titolo')}
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
                  onClick={() => handleSort('dataInizio')}
                  title="Clicca per ordinare"
                >
                  Inizio{renderSortIcon('dataInizio')}
                </th>
                <th className="text-right px-4 py-3 font-medium">Sessioni</th>
                <th className="text-right px-4 py-3 font-medium">Costo</th>
                <th className="text-right px-4 py-3 font-medium">Iscritti</th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('status')}
                  title="Clicca per ordinare"
                >
                  Stato{renderSortIcon('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Nessun corso trovato.
                  </td>
                </tr>
              ) : (
                data?.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/corsi/${c.id}`}
                        className="text-brand-700 hover:underline font-medium"
                      >
                        {c.titolo}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {c.codice ? `${c.codice} · ` : ''}
                        {c.docente ?? ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.academicYear?.label}</td>
                    <td className="px-4 py-3">{formatDate(c.dataInizio)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.numeroSessioni}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCents(c.costoCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.iscrittiAttivi ?? 0}
                      {c.postiMassimi ? ` / ${c.postiMassimi}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(c.status)}>{c.status.replace('_', ' ')}</Badge>
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

      <CourseImportModal
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

function CourseImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      const response = await fetch('/api/courses/import', {
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
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Importa corsi da Excel</h2>

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
