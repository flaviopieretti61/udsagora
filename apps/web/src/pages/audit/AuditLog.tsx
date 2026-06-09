import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { InputField, SelectField } from '../../components/Field';
import { Pagination } from '../../components/Pagination';
import { Badge } from '../../components/Badge';
import { useAuditLog, type AuditLogFilter } from '../../hooks/useAuditLog';
import { useUsers } from '../../hooks/useUsers';
import { formatDate } from '../../lib/format';

export function AuditLogPage() {
  const [filter, setFilter] = useState<AuditLogFilter>({ page: 1, pageSize: 50 });
  const { data, isLoading } = useAuditLog(filter);
  const { data: users } = useUsers();

  return (
    <div className="p-8">
      <PageHeader
        title="Audit log"
        subtitle="Storico delle azioni amministrative effettuate dagli utenti"
      />

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <SelectField
            label="Utente"
            value={filter.userId ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, userId: e.target.value || undefined, page: 1 })
            }
          >
            <option value="">Tutti</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Azione contiene"
            value={filter.action ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, action: e.target.value || undefined, page: 1 })
            }
            placeholder="MEMBER, FEE, USER…"
          />
          <InputField
            label="Tipo entità"
            value={filter.entityType ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, entityType: e.target.value || undefined, page: 1 })
            }
            placeholder="Member, Course…"
          />
          <InputField
            label="Dal"
            type="date"
            value={filter.from ?? ''}
            onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined, page: 1 })}
          />
          <InputField
            label="Al"
            type="date"
            value={filter.to ?? ''}
            onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined, page: 1 })}
          />
          <div className="flex items-end">
            <button
              className="btn-secondary"
              onClick={() => setFilter({ page: 1, pageSize: 50 })}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Caricamento…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Quando</th>
                <th className="text-left px-4 py-3 font-medium">Utente</th>
                <th className="text-left px-4 py-3 font-medium">Azione</th>
                <th className="text-left px-4 py-3 font-medium">Entità</th>
                <th className="text-left px-4 py-3 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nessun evento trovato.
                  </td>
                </tr>
              ) : (
                data?.items.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(e.createdAt)}{' '}
                      <span className="text-xs text-slate-500">
                        {new Date(e.createdAt).toLocaleTimeString('it-IT')}
                      </span>
                    </td>
                    <td className="px-4 py-3">{e.user?.fullName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{e.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {e.entityType}
                      {e.entityId && (
                        <div className="font-mono text-slate-400">{e.entityId.slice(0, 12)}…</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-md truncate">
                      {e.payload ?? ''}
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
            onPageChange={(p) => setFilter({ ...filter, page: p })}
          />
        </div>
      )}
    </div>
  );
}
