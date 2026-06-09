import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { MemberForm } from './MemberForm';
import { useDeleteMember, useMember, useUpdateMember } from '../../hooks/useMembers';
import { useMemberships } from '../../hooks/useMemberships';
import { formatDate } from '../../lib/format';
import { MemberMembershipsSection } from './MemberMembershipsSection';
import { MemberCoursesSection } from './MemberCoursesSection';

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: member, isLoading, isError, error } = useMember(id);
  const { data: membershipsRes } = useMemberships({ memberId: id });
  const update = useUpdateMember();
  const del = useDeleteMember();
  const [editing, setEditing] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // Determina il tipo di iscrizione più recente (approvata o in attesa).
  // Esclude annullate/rifiutate, che non rappresentano un'iscrizione valida.
  const lastMembershipType = useMemo(() => {
    if (!membershipsRes?.items || membershipsRes.items.length === 0) return null;
    const valid = membershipsRes.items
      .filter((m: any) => m.status === 'APPROVATA' || m.status === 'IN_ATTESA')
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    return valid[0]?.type ?? null;
  }, [membershipsRes]);

  if (isLoading) return <div className="p-8 text-slate-500">Caricamento…</div>;
  if (isError || !member)
    return (
      <div className="p-8 text-red-600">
        {error instanceof Error ? error.message : 'Errore nel caricamento'}
      </div>
    );

  if (editing) {
    return (
      <div className="p-8 max-w-4xl">
        <PageHeader title={`${member.cognome} ${member.nome}`} subtitle="Modifica anagrafica" />
        <MemberForm
          initial={member}
          submitLabel="Salva modifiche"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            await update.mutateAsync({ id: member.id, ...data });
            setEditing(false);
          }}
        />
      </div>
    );
  }

  async function handleDelete() {
    if (!member) return;
    if (!confirm(`Eliminare definitivamente il socio "${member.cognome} ${member.nome}"?`)) return;
    setDeleteErr(null);
    try {
      await del.mutateAsync(member.id);
      navigate('/soci', { replace: true });
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  }

  const indirizzoCompleto = [
    member.indirizzo,
    [member.cap, member.citta].filter(Boolean).join(' '),
    member.provincia ? `(${member.provincia})` : '',
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div className="p-8 max-w-4xl space-y-4">
      <PageHeader
        title={`${member.cognome} ${member.nome}`}
        subtitle={`Socio dal ${formatDate(member.createdAt)} · Categoria ${member.category.name}`}
        actions={
          <>
            <Link to="/soci" className="btn-secondary">
              ← Lista
            </Link>
            <a
              href={`/api/members/${member.id}/privacy-form.pdf?type=NUOVO`}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn-secondary ${lastMembershipType === 'RINNOVO' ? 'opacity-50 pointer-events-none' : ''}`}
              title={lastMembershipType === 'RINNOVO' ? 'Usa Scheda Privacy Rinnovo per i rinnovi' : ''}
            >
              Scheda Privacy Nuovo Socio (PDF)
            </a>
            <a
              href={`/api/members/${member.id}/privacy-form.pdf?type=RINNOVO`}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn-secondary ${lastMembershipType === 'NUOVA' ? 'opacity-50 pointer-events-none' : ''}`}
              title={lastMembershipType === 'NUOVA' ? 'Usa Scheda Privacy Nuovo Socio per le nuove iscrizioni' : ''}
            >
              Scheda Privacy Rinnovo (PDF)
            </a>
            <button className="btn-primary" onClick={() => setEditing(true)}>
              Modifica
            </button>
          </>
        }
      />

      {deleteErr && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {deleteErr}
        </div>
      )}

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Anagrafica</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Codice fiscale" value={member.codiceFiscale} mono />
          <Row label="Data di nascita" value={formatDate(member.dataNascita)} />
          <Row label="Luogo di nascita" value={member.luogoNascita} />
          <Row
            label="Genere"
            value={
              member.gender === 'M' ? 'Maschio' : member.gender === 'F' ? 'Femmina' : member.gender
            }
          />
        </dl>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Residenza</h2>
        <p className="text-sm text-slate-700">{indirizzoCompleto || '—'}</p>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Contatti</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Email" value={member.email} />
          <Row label="Telefono" value={member.telefono} />
          <Row label="Cellulare" value={member.cellulare} />
        </dl>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Privacy e note</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Privacy firmata il" value={formatDate(member.privacyFirmataIl)} />
        </dl>
        {member.note && (
          <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{member.note}</p>
        )}
      </section>

      <MemberMembershipsSection member={member} />
      <MemberCoursesSection member={member} />

      <section className="card border-red-200">
        <h2 className="font-semibold text-red-700 mb-2">Zona pericolosa</h2>
        <p className="text-sm text-slate-600 mb-3">
          L'eliminazione è possibile solo se il socio non ha iscrizioni o iscrizioni a corsi.
        </p>
        <button onClick={handleDelete} className="btn-secondary text-red-700 border-red-300">
          Elimina socio
        </button>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value || '—'}</dd>
    </div>
  );
}
