import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/Field';
import { centsToEuros, eurosToCents } from '../../lib/format';
import { useRecordPayment } from '../../hooks/useMemberships';
import type { MembershipListItem, PaymentMethod } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  membership: MembershipListItem | null;
}

const METHODS: PaymentMethod[] = ['CONTANTI', 'BONIFICO', 'POS', 'ALTRO'];

export function PaymentModal({ open, onClose, membership }: Props) {
  const record = useRecordPayment();
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('CONTANTI');
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setAmountStr(membership ? centsToEuros(membership.amountDueCents) : '');
    setDate(new Date().toISOString().slice(0, 10));
    setMethod('CONTANTI');
    setErr(null);
  }

  // Re-inizializza ad ogni apertura
  if (open && membership && amountStr === '') {
    reset();
  }

  async function submit() {
    if (!membership) return;
    const cents = eurosToCents(amountStr);
    if (cents === null) {
      setErr('Importo non valido');
      return;
    }
    setErr(null);
    try {
      await record.mutateAsync({
        id: membership.id,
        amountPaidCents: cents,
        paymentDate: date || undefined,
        paymentMethod: method,
      });
      reset();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Registra pagamento"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Annulla
          </button>
          <button className="btn-primary" onClick={submit} disabled={record.isPending}>
            {record.isPending ? 'Salvataggio…' : 'Registra'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {membership && (
          <div className="rounded bg-slate-50 p-3 text-sm">
            <div>
              <span className="text-slate-500">Socio:</span>{' '}
              {membership.member.cognome} {membership.member.nome}
            </div>
            <div>
              <span className="text-slate-500">Importo dovuto:</span>{' '}
              {centsToEuros(membership.amountDueCents)} €
            </div>
          </div>
        )}
        <InputField
          label="Importo pagato (€)"
          inputMode="decimal"
          placeholder="0,00"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
        />
        <InputField
          label="Data pagamento"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <SelectField
          label="Metodo"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
