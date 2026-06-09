import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { TextareaField } from '../../components/Field';
import { useRejectMembership } from '../../hooks/useMemberships';

interface Props {
  open: boolean;
  onClose: () => void;
  membershipId: string | null;
}

export function RejectModal({ open, onClose, membershipId }: Props) {
  const reject = useRejectMembership();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!membershipId) return;
    if (reason.trim().length === 0) {
      setErr('Motivo richiesto');
      return;
    }
    setErr(null);
    try {
      await reject.mutateAsync({ id: membershipId, rejectionReason: reason.trim() });
      setReason('');
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setReason('');
        setErr(null);
        onClose();
      }}
      title="Rifiuta iscrizione"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              setReason('');
              setErr(null);
              onClose();
            }}
          >
            Annulla
          </button>
          <button className="btn-primary" onClick={submit} disabled={reject.isPending}>
            {reject.isPending ? 'Salvataggio…' : 'Rifiuta'}
          </button>
        </>
      }
    >
      <TextareaField
        label="Motivo del rifiuto"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={err ?? undefined}
      />
    </Modal>
  );
}
