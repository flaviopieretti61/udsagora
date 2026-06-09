import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { CourseForm } from './CourseForm';
import { EnrollMemberModal } from './EnrollMemberModal';
import { useAuth } from '../../auth/AuthContext';
import { useCourse, useDeleteCourse, useUpdateCourse } from '../../hooks/useCourses';
import {
  useCancelEnrollment,
  useDeleteEnrollment,
  useEnrollmentsByCourse,
  useRestoreEnrollment,
} from '../../hooks/useCourseEnrollments';
import { formatCents, formatDate } from '../../lib/format';
import type { CourseEnrollment, CourseStatus } from '../../types';

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

export function CourseDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(id);
  const update = useUpdateCourse();
  const del = useDeleteCourse();
  const { data: enrollments } = useEnrollmentsByCourse(id);
  const cancelEnr = useCancelEnrollment();
  const restoreEnr = useRestoreEnrollment();
  const delEnr = useDeleteEnrollment();

  const [editing, setEditing] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  if (isLoading) return <div className="p-8 text-slate-500">Caricamento…</div>;
  if (!course) return <div className="p-8 text-red-600">Corso non trovato</div>;

  if (editing) {
    return (
      <div className="p-8 max-w-4xl">
        <PageHeader title={course.titolo} subtitle="Modifica corso" />
        <CourseForm
          initial={course}
          submitLabel="Salva modifiche"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            await update.mutateAsync({ id: course.id, ...data });
            setEditing(false);
          }}
        />
      </div>
    );
  }

  async function handleDelete() {
    if (!course) return;
    if (!confirm(`Eliminare il corso "${course.titolo}"?`)) return;
    setActionErr(null);
    try {
      await del.mutateAsync(course.id);
      navigate('/corsi', { replace: true });
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Errore');
    }
  }

  async function handleCancelEnrollment(e: CourseEnrollment) {
    if (!e.member) return;
    if (!confirm(`Annullare iscrizione di ${e.member.cognome} ${e.member.nome}?`)) return;
    setActionErr(null);
    try {
      await cancelEnr.mutateAsync(e.id);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Errore');
    }
  }

  async function handleRestoreEnrollment(e: CourseEnrollment) {
    if (!e.member) return;
    if (!confirm(`Ripristinare iscrizione di ${e.member.cognome} ${e.member.nome}?`)) return;
    setActionErr(null);
    try {
      await restoreEnr.mutateAsync(e.id);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Errore');
    }
  }

  async function handleDeleteEnrollment(e: CourseEnrollment) {
    if (!confirm("Eliminare l'iscrizione? Operazione irreversibile.")) return;
    setActionErr(null);
    try {
      await delEnr.mutateAsync(e.id);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Errore');
    }
  }

  return (
    <div className="p-8 max-w-5xl space-y-4">
      <PageHeader
        title={course.titolo}
        subtitle={`${course.academicYear?.label ?? ''} · ${course.codice ?? ''}`}
        actions={
          <>
            <Link to="/corsi" className="btn-secondary">
              ← Lista
            </Link>
            <a
              href={`/api/courses/${course.id}/enrollments-list.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              title="Stampa elenco iscritti al corso"
            >
              Elenco Iscritti (PDF)
            </a>
            <a
              href={`/api/courses/${course.id}/attendance.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              title="Stampa foglio firme di presenza"
            >
              Foglio Firme (PDF)
            </a>
            {isAdmin && (
              <button className="btn-primary" onClick={() => setEditing(true)}>
                Modifica
              </button>
            )}
          </>
        }
      />

      {actionErr && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {actionErr}
        </div>
      )}

      <section className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Field label="Stato">
            <Badge tone={statusTone(course.status)}>{course.status.replace('_', ' ')}</Badge>
          </Field>
          <Field label="Docente">{course.docente ?? '—'}</Field>
          <Field label="Sede">{course.sede ?? '—'}</Field>
          <Field label="Data inizio">{formatDate(course.dataInizio)}</Field>
          <Field label="Numero sessioni">{course.numeroSessioni}</Field>
          <Field label="Costo">{formatCents(course.costoCents)}</Field>
          <Field label="Posti massimi">{course.postiMassimi ?? 'illimitati'}</Field>
        </div>
        {course.descrizione && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
            {course.descrizione}
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">
            Iscritti{' '}
            <span className="text-slate-500 text-sm font-normal">
              ({enrollments?.filter((e) => e.status === 'ATTIVA').length ?? 0}
              {course.postiMassimi ? ` / ${course.postiMassimi}` : ''} attivi)
            </span>
          </h2>
          <button
            className="btn-primary text-sm"
            onClick={() => setEnrollOpen(true)}
            disabled={course.status === 'ANNULLATO' || course.status === 'CHIUSO'}
            title={
              course.status === 'ANNULLATO' || course.status === 'CHIUSO'
                ? `Corso ${course.status}: iscrizioni bloccate`
                : 'Iscrivi socio'
            }
          >
            + Iscrivi socio
          </button>
        </div>

        {enrollments && enrollments.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun iscritto.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left py-1 font-medium">Socio</th>
                <th className="text-left py-1 font-medium">Stato</th>
                <th className="text-right py-1 font-medium">Dovuto</th>
                <th className="text-right py-1 font-medium">Pagato</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments
                ?.sort((a, b) => {
                  if (!a.member || !b.member) return 0;
                  const cognomeComp = a.member.cognome.localeCompare(b.member.cognome);
                  return cognomeComp !== 0 ? cognomeComp : a.member.nome.localeCompare(b.member.nome);
                })
                .map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="py-2">
                    {e.member && (
                      <>
                        <Link
                          to={`/soci/${e.member.id}`}
                          className="text-brand-700 hover:underline font-medium"
                        >
                          {e.member.cognome} {e.member.nome}
                        </Link>
                        <div className="text-xs text-slate-500">{e.member.category.name}</div>
                      </>
                    )}
                  </td>
                  <td className="py-2">
                    <Badge tone={e.status === 'ATTIVA' ? 'green' : 'red'}>{e.status}</Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCents(e.amountDueCents)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCents(e.amountPaidCents)}
                    {e.paymentDate && (
                      <div className="text-xs text-slate-500">{formatDate(e.paymentDate)}</div>
                    )}
                  </td>
                  <td className="py-2 text-right text-xs space-x-2 whitespace-nowrap">
                    {e.status === 'ATTIVA' && (
                      <button
                        className="text-slate-600 hover:underline"
                        onClick={() => handleCancelEnrollment(e)}
                      >
                        Annulla
                      </button>
                    )}
                    {e.status === 'ANNULLATA' && (
                      <button
                        className="text-green-600 hover:underline"
                        onClick={() => handleRestoreEnrollment(e)}
                      >
                        Ripristina
                      </button>
                    )}
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => handleDeleteEnrollment(e)}
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isAdmin && (
        <section className="card border-red-200">
          <h2 className="font-semibold text-red-700 mb-2">Zona pericolosa</h2>
          <p className="text-sm text-slate-600 mb-3">
            Eliminazione possibile solo se il corso non ha iscrizioni (anche annullate). Per fermare
            un corso preferisci impostare lo stato a "ANNULLATO" o "CHIUSO".
          </p>
          <button onClick={handleDelete} className="btn-secondary text-red-700 border-red-300">
            Elimina corso
          </button>
        </section>
      )}

      <EnrollMemberModal open={enrollOpen} onClose={() => setEnrollOpen(false)} course={course} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
