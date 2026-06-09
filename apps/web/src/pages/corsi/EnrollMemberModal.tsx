import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { InputField } from '../../components/Field';
import { useMembers } from '../../hooks/useMembers';
import { useCreateEnrollment } from '../../hooks/useCourseEnrollments';
import { centsToEuros, eurosToCents, formatCents } from '../../lib/format';
import type { Course } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  course: Course;
}

export function EnrollMemberModal({ open, onClose, course }: Props) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [amountDueStr, setAmountDueStr] = useState(centsToEuros(course.costoCents));
  const [amountPaidStr, setAmountPaidStr] = useState(centsToEuros(course.costoCents));
  const [method, setMethod] = useState('');
  const [inscriptionDate, setInscriptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptNumber, setReceiptNumber] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const create = useCreateEnrollment();
  const { data: members } = useMembers({ q: q || undefined, pageSize: 8 });

  // Reset all'apertura
  useEffect(() => {
    if (open) {
      setQ('');
      setSelected(null);
      setAmountDueStr(centsToEuros(course.costoCents));
      setAmountPaidStr(centsToEuros(course.costoCents));
      setMethod('');
      setInscriptionDate(new Date().toISOString().slice(0, 10));
      setReceiptNumber('');
      setErr(null);
      setWarning(null);
    }
  }, [open, course.costoCents]);

  const options = useMemo(() => members?.items ?? [], [members]);

  async function submit() {
    setErr(null);
    setWarning(null);
    if (!selected) {
      setErr('Selezionare un socio');
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
    const dueCents = eurosToCents(amountDueStr);
    if (dueCents === null) {
      setErr('Importo dovuto non valido');
      return;
    }
    const paidCents = eurosToCents(amountPaidStr);
    if (paidCents === null) {
      setErr('Importo pagato non valido');
      return;
    }
    try {
      const response = await create.mutateAsync({
        courseId: course.id,
        memberId: selected.id,
        amountDueCents: dueCents,
        paymentMethod: method as any,
        amountPaidCents: paidCents,
        paymentDate: inscriptionDate,
        receiptNumber: receiptNumber.trim(),
      });
      if (response.warning) {
        setWarning(response.warning);
      } else {
        onClose();
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Iscrivi socio al corso"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
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
          <div>
            <span className="text-slate-500">Corso:</span> {course.titolo}
          </div>
          <div>
            <span className="text-slate-500">Costo:</span> {formatCents(course.costoCents)}
          </div>
        </div>

        <InputField
          label="Cerca socio (cognome, nome, CF…)"
          placeholder="Inizia a digitare per filtrare"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
          }}
        />

        {!selected && q.length > 0 && (
          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded">
            {options.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">Nessun socio trovato.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {options.map((m) => (
                  <li
                    key={m.id}
                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                    onClick={() => {
                      setSelected({ id: m.id, label: `${m.cognome} ${m.nome}` });
                      setQ('');
                    }}
                  >
                    <div className="font-medium">
                      {m.cognome} {m.nome}
                    </div>
                    <div className="text-xs text-slate-500">
                      {m.category.name}
                      {m.codiceFiscale ? ` · ${m.codiceFiscale}` : ''}
                      {m.currentMembership ? ` · tessera ${m.currentMembership.status}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selected && (
          <div className="rounded border border-brand-200 bg-brand-50 p-3 flex items-center justify-between">
            <div className="text-sm">
              <div className="text-slate-500 text-xs">Socio selezionato</div>
              <div className="font-medium">{selected.label}</div>
            </div>
            <button
              className="text-sm text-slate-600 hover:underline"
              onClick={() => setSelected(null)}
            >
              Cambia
            </button>
          </div>
        )}

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

        <div>
          <label className="label">Numero Blocco / Ricevuta <span className="text-red-500">*</span></label>
          <input
            className="input"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            placeholder=""
            required
          />
        </div>

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
