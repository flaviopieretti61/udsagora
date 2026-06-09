import { useMemo, useState } from 'react';
import { SelectField } from '../../components/Field';
import { Badge } from '../../components/Badge';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { useCategories } from '../../hooks/useCategories';
import {
  useCreateFee,
  useDeleteFee,
  useMembershipFees,
  useUpdateFee,
} from '../../hooks/useMembershipFees';
import { centsToEuros, eurosToCents, formatCents } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import type { MembershipType } from '../../types';

const TYPES: MembershipType[] = ['NUOVA', 'RINNOVO'];

export function FeesPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data: years } = useAcademicYears();
  const { data: categories } = useCategories();

  const defaultYearId = useMemo(
    () => years?.find((y) => y.active)?.id ?? years?.[0]?.id,
    [years],
  );
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const effectiveYearId = yearId ?? defaultYearId;

  const { data: fees, isLoading } = useMembershipFees(effectiveYearId);
  const create = useCreateFee();
  const update = useUpdateFee();
  const del = useDeleteFee();

  // Matrice categoria × tipo
  const grid: Record<string, Record<MembershipType, { id: string; amount: number } | null>> = {};
  categories?.forEach((c) => {
    grid[c.id] = { NUOVA: null, RINNOVO: null };
  });
  fees?.forEach((f) => {
    if (grid[f.categoryId]) {
      grid[f.categoryId][f.type] = { id: f.id, amount: f.amountCents };
    }
  });

  return (
    <div className="space-y-4">
      <div className="card flex items-end gap-3">
        <SelectField
          label="Anno accademico"
          value={effectiveYearId ?? ''}
          onChange={(e) => setYearId(e.target.value || undefined)}
          className="max-w-xs"
        >
          {years?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.active ? ' (attivo)' : ''}
            </option>
          ))}
        </SelectField>
        {!effectiveYearId && (
          <p className="text-sm text-slate-500 pb-2">Crea prima un anno accademico.</p>
        )}
      </div>

      {effectiveYearId && (
        <div className="card overflow-hidden p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Caricamento…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Categoria</th>
                  {TYPES.map((t) => (
                    <th key={t} className="text-left px-4 py-3 font-medium">
                      Quota {t.toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories?.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    {TYPES.map((t) => (
                      <td key={t} className="px-4 py-3">
                        <FeeCell
                          isAdmin={isAdmin}
                          fee={grid[c.id]?.[t] ?? null}
                          onSave={async (amountCents) => {
                            const existing = grid[c.id]?.[t];
                            if (existing) {
                              await update.mutateAsync({ id: existing.id, amountCents });
                            } else {
                              await create.mutateAsync({
                                academicYearId: effectiveYearId,
                                categoryId: c.id,
                                type: t,
                                amountCents,
                              });
                            }
                          }}
                          onDelete={async () => {
                            const existing = grid[c.id]?.[t];
                            if (existing) await del.mutateAsync(existing.id);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function FeeCell({
  fee,
  isAdmin,
  onSave,
  onDelete,
}: {
  fee: { id: string; amount: number } | null;
  isAdmin: boolean;
  onSave: (amountCents: number) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fee ? centsToEuros(fee.amount) : '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return fee ? (
      <span className="tabular-nums">{formatCents(fee.amount)}</span>
    ) : (
      <Badge>non impostata</Badge>
    );
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const cents = eurosToCents(value);
          if (cents === null) {
            setErr('Importo non valido');
            return;
          }
          setErr(null);
          setBusy(true);
          try {
            await onSave(cents);
            setEditing(false);
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : 'Errore');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          autoFocus
          className="input w-24"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0,00"
        />
        <span className="text-slate-500">€</span>
        <button type="submit" className="text-sm text-brand-700 hover:underline" disabled={busy}>
          Salva
        </button>
        <button
          type="button"
          className="text-sm text-slate-500 hover:underline"
          onClick={() => {
            setEditing(false);
            setValue(fee ? centsToEuros(fee.amount) : '');
            setErr(null);
          }}
        >
          Annulla
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {fee ? (
        <>
          <span className="tabular-nums">{formatCents(fee.amount)}</span>
          <button
            className="text-xs text-brand-700 hover:underline"
            onClick={() => setEditing(true)}
          >
            Modifica
          </button>
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={async () => {
              if (!confirm('Eliminare la quota?')) return;
              await onDelete();
            }}
          >
            Elimina
          </button>
        </>
      ) : (
        <>
          <Badge>non impostata</Badge>
          <button
            className="text-xs text-brand-700 hover:underline"
            onClick={() => setEditing(true)}
          >
            Imposta
          </button>
        </>
      )}
    </div>
  );
}
