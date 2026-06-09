import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/Field';
import { useCourses } from '../../hooks/useCourses';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import {
  useCancelEnrollment,
  useCreateEnrollment,
  useDeleteEnrollment,
  useEnrollmentsByMember,
} from '../../hooks/useCourseEnrollments';
import { centsToEuros, eurosToCents, formatCents, formatDate } from '../../lib/format';
import type { MemberDetail, CourseEnrollment } from '../../types';

interface Props {
  member: MemberDetail;
}

export function MemberCoursesSection({ member }: Props) {
  const { data: enrollments } = useEnrollmentsByMember(member.id);
  const cancel = useCancelEnrollment();
  const del = useDeleteEnrollment();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<CourseEnrollment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleCancel(id: string) {
    if (!confirm("Annullare l'iscrizione al corso?")) return;
    setErr(null);
    try {
      await cancel.mutateAsync(id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function handleDelete(enrollment: CourseEnrollment) {
    if (
      !confirm(
        `Eliminare definitivamente l'iscrizione al corso "${enrollment.course?.titolo}"? Questa azione è irreversibile.`,
      )
    ) {
      return;
    }
    if (!confirm('Sei sicuro? Non potrai più recuperare questi dati.')) {
      return;
    }
    setErr(null);
    try {
      await del.mutateAsync(enrollment.id);
      setDeleteFor(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore eliminazione');
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Iscrizioni ai corsi</h2>
        <button className="btn-primary text-xs" onClick={() => setEnrollOpen(true)}>
          + Iscrivi a un corso
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {!enrollments || enrollments.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuna iscrizione a corsi.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left py-1 font-medium">Corso</th>
              <th className="text-left py-1 font-medium">Anno</th>
              <th className="text-left py-1 font-medium">Stato</th>
              <th className="text-left py-1 font-medium">Data iscrizione</th>
              <th className="text-right py-1 font-medium">Dovuto</th>
              <th className="text-right py-1 font-medium">Pagato</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enrollments.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="py-2">
                  {e.course && (
                    <Link
                      to={`/corsi/${e.course.id}`}
                      className="text-brand-700 hover:underline font-medium"
                    >
                      {e.course.titolo}
                    </Link>
                  )}
                  {e.course?.dataInizio && (
                    <div className="text-xs text-slate-500">
                      Inizio {formatDate(e.course.dataInizio)}
                    </div>
                  )}
                </td>
                <td className="py-2">{e.course?.academicYear?.label}</td>
                <td className="py-2">
                  <Badge tone={e.status === 'ATTIVA' ? 'green' : 'red'}>{e.status}</Badge>
                </td>
                <td className="py-2 text-xs text-slate-600">
                  {formatDate(e.createdAt)}
                  {e.paymentDate && (
                    <div className="text-xs text-slate-500">Pagato: {formatDate(e.paymentDate)}</div>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{formatCents(e.amountDueCents)}</td>
                <td className="py-2 text-right tabular-nums">{formatCents(e.amountPaidCents)}</td>
                <td className="py-2 text-right text-xs space-x-2 whitespace-nowrap">
                  {e.status === 'ATTIVA' && (
                    <button
                      className="text-slate-600 hover:underline"
                      onClick={() => handleCancel(e.id)}
                    >
                      Annulla
                    </button>
                  )}
                  {e.status === 'ANNULLATA' && (
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => setDeleteFor(e)}
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

      <EnrollFromMemberModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        member={member}
      />

      {deleteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-red-700 mb-3">Elimina iscrizione al corso</h3>
            <p className="text-sm text-slate-700 mb-4">
              Stai per eliminare definitivamente l'iscrizione al corso{' '}
              <strong>{deleteFor.course?.titolo}</strong>. Questa azione è
              <strong> irreversibile</strong> e non potrai più recuperare questi dati.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              Dopo l'eliminazione, potrai creare una nuova iscrizione al corso.
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
                onClick={() => handleDelete(deleteFor)}
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

function EnrollFromMemberModal({
  open,
  onClose,
  member,
}: {
  open: boolean;
  onClose: () => void;
  member: MemberDetail;
}) {
  const { data: years } = useAcademicYears();
  const activeYear = years?.find((y) => y.active);
  const [yearId, setYearId] = useState<string | undefined>(activeYear?.id);
  const effectiveYearId = yearId ?? activeYear?.id;
  const { data: courses } = useCourses({
    academicYearId: effectiveYearId,
    pageSize: 100,
  });
  const create = useCreateEnrollment();
  const [courseId, setCourseId] = useState<string>('');
  const [amountDueStr, setAmountDueStr] = useState('');
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [method, setMethod] = useState('');
  const [inscriptionDate, setInscriptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptNumber, setReceiptNumber] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const selectedCourse = courses?.items.find((c) => c.id === courseId);

  function resetAfterClose() {
    setCourseId('');
    setAmountDueStr('');
    setAmountPaidStr('');
    setMethod('');
    setInscriptionDate(new Date().toISOString().slice(0, 10));
    setReceiptNumber('');
    setErr(null);
    setWarning(null);
  }

  async function submit() {
    setErr(null);
    setWarning(null);
    if (!courseId || !selectedCourse) {
      setErr('Selezionare un corso');
      return;
    }
    if (!method) {
      setErr('Selezionare un metodo di pagamento');
      return;
    }
    if (!receiptNumber.trim()) {
      setErr('Inserire il numero blocco / ricevuta');
      return;
    }
    const dueCents = amountDueStr ? eurosToCents(amountDueStr) : selectedCourse.costoCents;
    if (dueCents === null) {
      setErr('Importo dovuto non valido');
      return;
    }
    const paidCents = amountPaidStr ? eurosToCents(amountPaidStr) : selectedCourse.costoCents;
    if (paidCents === null) {
      setErr('Importo pagato non valido');
      return;
    }
    try {
      const response = await create.mutateAsync({
        memberId: member.id,
        courseId,
        amountDueCents: dueCents,
        paymentMethod: method as any,
        amountPaidCents: paidCents,
        paymentDate: inscriptionDate,
        receiptNumber: receiptNumber.trim(),
      });
      if (response.warning) {
        setWarning(response.warning);
      } else {
        resetAfterClose();
        onClose();
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        resetAfterClose();
        onClose();
      }}
      title="Iscrivi a un corso"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              resetAfterClose();
              onClose();
            }}
          >
            {warning ? 'Chiudi' : 'Annulla'}
          </button>
          {!warning && (
            <button className="btn-primary" onClick={submit} disabled={create.isPending}>
              {create.isPending ? 'Salvataggio…' : 'Iscrivi'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded bg-slate-50 p-3 text-sm">
          <div className="text-slate-500 text-xs">Socio</div>
          <div className="font-medium">
            {member.cognome} {member.nome}
          </div>
        </div>

        <SelectField
          label="Anno accademico"
          value={effectiveYearId ?? ''}
          onChange={(e) => setYearId(e.target.value || undefined)}
        >
          {years?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.active ? ' (attivo)' : ''}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Corso"
          required
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            const c = courses?.items.find((x) => x.id === e.target.value);
            if (c) {
              setAmountDueStr(centsToEuros(c.costoCents));
              setAmountPaidStr(centsToEuros(c.costoCents));
            }
          }}
        >
          <option value="">— Seleziona —</option>
          {courses?.items
            .filter((c) => c.status === 'APERTO' || c.status === 'IN_PREPARAZIONE')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.titolo} — {formatCents(c.costoCents)}
                {c.postiMassimi
                  ? ` (${c.iscrittiAttivi ?? 0}/${c.postiMassimi} iscritti)`
                  : ''}
              </option>
            ))}
        </SelectField>

        <div>
          <label className="label">Data iscrizione</label>
          <input
            type="date"
            className="input"
            value={inscriptionDate}
            onChange={(e) => setInscriptionDate(e.target.value)}
            required
          />
        </div>

        {selectedCourse && (
          <>
            <div>
              <label className="label">Importo dovuto</label>
              <div className="flex items-center gap-2">
                <input
                  className="input w-40"
                  value={amountDueStr}
                  readOnly
                  placeholder="0,00"
                  inputMode="decimal"
                />
                <span className="text-slate-500">€</span>
              </div>
            </div>

            <div>
              <label className="label">Importo pagato</label>
              <div className="flex items-center gap-2">
                <input
                  className="input w-40"
                  value={amountPaidStr}
                  onChange={(e) => setAmountPaidStr(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
                <span className="text-slate-500">€</span>
              </div>
            </div>
          </>
        )}

        {selectedCourse && (
          <div>
            <label className="label">Metodo di pagamento *</label>
            <select
              className="input"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">— Seleziona —</option>
              <option value="CONTANTI">Contanti</option>
              <option value="POS">POS</option>
              <option value="BONIFICO">Bonifico</option>
              <option value="ALTRO">Altro</option>
            </select>
          </div>
        )}

        {selectedCourse && (
          <div>
            <label className="label">
              Numero Blocco / Ricevuta <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              required
            />
          </div>
        )}

        {warning && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠ Iscrizione creata, ma: {warning}
          </div>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}

