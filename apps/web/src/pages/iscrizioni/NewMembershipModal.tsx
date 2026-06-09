import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/Field';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { useMembershipFees } from '../../hooks/useMembershipFees';
import { useCreateMembership } from '../../hooks/useMemberships';
import { centsToEuros, eurosToCents, formatCents } from '../../lib/format';
import type { MembershipType } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  categoryId: string;
  onCreated?: (membershipId: string) => void;
}

export function NewMembershipModal({
  open,
  onClose,
  memberId,
  categoryId,
  onCreated,
}: Props) {
  const { data: years } = useAcademicYears();
  const activeYear = useMemo(() => years?.find((y) => y.active), [years]);
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [type, setType] = useState<MembershipType | ''>('');
  const { data: fees } = useMembershipFees(academicYearId || activeYear?.id);
  const create = useCreateMembership();

  const [amountDueStr, setAmountDueStr] = useState('');
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [method, setMethod] = useState('');
  const [inscriptionDate, setInscriptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptNumber, setReceiptNumber] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Sincronizza l'anno attivo
  useEffect(() => {
    if (!academicYearId && activeYear) setAcademicYearId(activeYear.id);
  }, [academicYearId, activeYear]);

  // Auto-calcola importo dalla quota configurata
  const suggested = useMemo(() => {
    if (!academicYearId || !categoryId) return null;
    const f = fees?.find(
      (x) =>
        x.academicYearId === academicYearId &&
        x.categoryId === categoryId &&
        x.type === type,
    );
    return f?.amountCents ?? null;
  }, [fees, academicYearId, categoryId, type]);

  useEffect(() => {
    if (suggested !== null) {
      setAmountDueStr(centsToEuros(suggested));
      setAmountPaidStr(centsToEuros(suggested));
    }
  }, [suggested]);

  function reset() {
    setAmountDueStr('');
    setAmountPaidStr('');
    setMethod('');
    setInscriptionDate(new Date().toISOString().slice(0, 10));
    setReceiptNumber('');
    setErr(null);
    setType('');
  }

  async function submit() {
    setErr(null);
    if (!academicYearId) {
      setErr('Selezionare un anno accademico');
      return;
    }
    if (!type) {
      setErr('Selezionare un tipo (Rinnovo o Nuova iscrizione)');
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
    const dueCents = amountDueStr ? eurosToCents(amountDueStr) : suggested;
    if (dueCents === null) {
      setErr('Importo dovuto non valido');
      return;
    }
    const paidCents = amountPaidStr ? eurosToCents(amountPaidStr) : suggested;
    if (paidCents === null) {
      setErr('Importo pagato non valido');
      return;
    }
    try {
      const created = await create.mutateAsync({
        memberId,
        academicYearId,
        type,
        amountDueCents: dueCents,
        paymentMethod: method as any,
        amountPaidCents: paidCents,
        paymentDate: inscriptionDate,
        receiptNumber: receiptNumber.trim(),
      });
      onCreated?.(created.id);
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
      title="Nuova iscrizione / rinnovo"
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
          <button className="btn-primary" onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Salvataggio…' : 'Crea (in attesa di approvazione)'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectField
          label="Anno accademico"
          required
          value={academicYearId}
          onChange={(e) => setAcademicYearId(e.target.value)}
        >
          <option value="">— Seleziona —</option>
          {years?.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
              {y.active ? ' (attivo)' : ''}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Tipo"
          required
          value={type}
          onChange={(e) => setType(e.target.value as MembershipType | '')}
        >
          <option value="">— Seleziona —</option>
          <option value="RINNOVO">Rinnovo</option>
          <option value="NUOVA">Nuova iscrizione</option>
        </SelectField>

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
            {suggested !== null && (
              <span className="text-xs text-slate-500">
                Quota configurata: {formatCents(suggested)}
              </span>
            )}
            {suggested === null && (
              <span className="text-xs text-amber-700">
                Nessuna quota configurata
              </span>
            )}
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

        <SelectField
          label="Metodo di pagamento"
          required
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="">— Seleziona —</option>
          <option value="CONTANTI">Contanti</option>
          <option value="POS">POS</option>
          <option value="BONIFICO">Bonifico</option>
          <option value="ALTRO">Altro</option>
        </SelectField>

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

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
