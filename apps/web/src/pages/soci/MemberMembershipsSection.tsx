import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { formatCents, formatDate } from '../../lib/format';
import {
  useApproveMembership,
  useCancelMembership,
  useDeleteMembership,
  useMemberships,
} from '../../hooks/useMemberships';
import { useAuth } from '../../auth/AuthContext';
import { NewMembershipModal } from '../iscrizioni/NewMembershipModal';
import { PaymentModal } from '../iscrizioni/PaymentModal';
import { RejectModal } from '../iscrizioni/RejectModal';
import { statusLabel, statusTone } from '../iscrizioni/helpers';
import type { MemberDetail, MembershipListItem } from '../../types';

interface Props {
  member: MemberDetail;
}

export function MemberMembershipsSection({ member }: Props) {
  const { user } = useAuth();
  const isConsiglio = user?.role === 'ADMIN' || user?.role === 'CONSIGLIO';
  const { data, refetch } = useMemberships({ memberId: member.id, pageSize: 50 });
  const approve = useApproveMembership();
  const cancel = useCancelMembership();
  const del = useDeleteMembership();

  const [newOpen, setNewOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<MembershipListItem | null>(null);
  const [rejectFor, setRejectFor] = useState<MembershipListItem | null>(null);
  const [deleteFor, setDeleteFor] = useState<MembershipListItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const items = data?.items ?? [];

  // Forza refetch quando cancel viene eseguito con successo
  useEffect(() => {
    if (cancel.isSuccess) {
      refetch();
    }
  }, [cancel.isSuccess, refetch]);

  async function doApprove(m: MembershipListItem) {
    setErr(null);
    try {
      await approve.mutateAsync(m.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function doCancel(m: MembershipListItem) {
    if (!confirm("Annullare l'iscrizione?")) return;
    setErr(null);
    try {
      await cancel.mutateAsync(m.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function doDelete(m: MembershipListItem) {
    if (
      !confirm(
        `Eliminare definitivamente l'iscrizione "${m.type}" per ${m.academicYear.label}? Questa azione è irreversibile.`,
      )
    ) {
      return;
    }
    if (!confirm('Sei sicuro? Non potrai più recuperare questi dati.')) {
      return;
    }
    setErr(null);
    try {
      await del.mutateAsync(m.id);
      setDeleteFor(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore eliminazione');
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Iscrizioni / rinnovi</h2>
        <button className="btn-primary text-xs" onClick={() => setNewOpen(true)}>
          + Nuova iscrizione
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuna iscrizione registrata.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left py-1 font-medium">Anno</th>
              <th className="text-left py-1 font-medium">Tipo</th>
              <th className="text-left py-1 font-medium">Stato</th>
              <th className="text-left py-1 font-medium">Data iscrizione</th>
              <th className="text-right py-1 font-medium">Dovuto</th>
              <th className="text-right py-1 font-medium">Pagato</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((m) => (
              <tr key={m.id} className="align-top">
                <td className="py-2">{m.academicYear.label}</td>
                <td className="py-2">
                  <Badge tone="blue">{m.type}</Badge>
                </td>
                <td className="py-2">
                  <Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
                </td>
                <td className="py-2 text-xs text-slate-600">
                  {formatDate(m.createdAt)}
                  {(m.status === 'APPROVATA' || m.status === 'ANNULLATA' || m.status === 'RIFIUTATA') && m.approvedAt && (
                    <>
                      <div className="text-xs text-slate-500">
                        {m.status === 'APPROVATA' && 'Approvato'}
                        {m.status === 'ANNULLATA' && 'Annullato'}
                        {m.status === 'RIFIUTATA' && 'Rifiutato'}
                        : {formatDate(m.approvedAt)}
                      </div>
                      {m.approvedBy && <div className="text-xs text-slate-500">da {m.approvedBy.fullName}</div>}
                    </>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{formatCents(m.amountDueCents)}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatCents(m.amountPaidCents)}
                  {m.paymentDate && (
                    <div className="text-xs text-slate-500">{formatDate(m.paymentDate)}</div>
                  )}
                </td>
                <td className="py-2 text-right text-xs space-x-2 whitespace-nowrap">
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
                  {m.status === 'ANNULLATA' && (
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => setDeleteFor(m)}
                    >
                      Elimina
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <NewMembershipModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        memberId={member.id}
        categoryId={member.categoryId}
      />
      <PaymentModal
        open={!!paymentFor}
        membership={paymentFor}
        onClose={() => setPaymentFor(null)}
      />
      <RejectModal
        open={!!rejectFor}
        membershipId={rejectFor?.id ?? null}
        onClose={() => setRejectFor(null)}
      />

      {deleteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-red-700 mb-3">Elimina iscrizione</h3>
            <p className="text-sm text-slate-700 mb-4">
              Stai per eliminare definitivamente l'iscrizione <strong>{deleteFor.type}</strong> per
              l'anno <strong>{deleteFor.academicYear.label}</strong>. Questa azione è
              <strong> irreversibile</strong> e non potrai più recuperare questi dati.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              Dopo l'eliminazione, potrai creare una nuova iscrizione per lo stesso anno.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary"
                onClick={() => setDeleteFor(null)}
                disabled={del.isPending}
              >
                Annulla
              </button>
              <button
                className="btn-secondary text-red-700 border-red-300"
                onClick={() => doDelete(deleteFor)}
                disabled={del.isPending}
              >
                {del.isPending ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
