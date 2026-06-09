import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputField } from '../../components/Field';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../lib/format';
import {
  useAcademicYears,
  useActivateAcademicYear,
  useCreateAcademicYear,
  useDeleteAcademicYear,
} from '../../hooks/useAcademicYears';
import { useAuth } from '../../auth/AuthContext';

const schema = z
  .object({
    label: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, 'Formato: 2025/2026'),
    startDate: z.string().min(1, 'Obbligatorio'),
    endDate: z.string().min(1, 'Obbligatorio'),
    active: z.boolean().optional(),
  })
  .refine((d) => Date.parse(d.startDate) < Date.parse(d.endDate), {
    message: 'Data fine deve essere successiva a data inizio',
    path: ['endDate'],
  });
type FormValues = z.infer<typeof schema>;

export function AcademicYearsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data: years, isLoading } = useAcademicYears();
  const create = useCreateAcademicYear();
  const activate = useActivateAcademicYear();
  const del = useDeleteAcademicYear();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', startDate: '', endDate: '', active: false },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await create.mutateAsync(values);
      form.reset({ label: '', startDate: '', endDate: '', active: false });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore');
    }
  }

  async function handleActivate(id: string) {
    try {
      await activate.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore');
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Eliminare l'anno accademico "${label}"?`)) return;
    try {
      await del.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Caricamento…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Anno</th>
                <th className="text-left px-4 py-3 font-medium">Periodo</th>
                <th className="text-right px-4 py-3 font-medium">Iscrizioni</th>
                <th className="text-right px-4 py-3 font-medium">Corsi</th>
                <th className="text-left px-4 py-3 font-medium">Stato</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {years?.map((y) => (
                <tr key={y.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{y.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(y.startDate)} → {formatDate(y.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{y.membershipsCount ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{y.coursesCount ?? 0}</td>
                  <td className="px-4 py-3">
                    {y.active ? <Badge tone="green">Attivo</Badge> : <Badge>Non attivo</Badge>}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {!y.active && (
                        <button
                          className="text-sm text-brand-700 hover:underline"
                          onClick={() => handleActivate(y.id)}
                        >
                          Attiva
                        </button>
                      )}
                      <button
                        className="text-sm text-red-600 hover:underline disabled:opacity-40"
                        disabled={
                          (y.membershipsCount ?? 0) > 0 || (y.coursesCount ?? 0) > 0
                        }
                        title={
                          (y.membershipsCount ?? 0) > 0 || (y.coursesCount ?? 0) > 0
                            ? 'Anno con iscrizioni/corsi: non eliminabile'
                            : 'Elimina'
                        }
                        onClick={() => handleDelete(y.id, y.label)}
                      >
                        Elimina
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="card space-y-3 self-start">
          <h3 className="font-semibold text-slate-800">Nuovo anno accademico</h3>
          <InputField
            label="Etichetta"
            required
            placeholder="2026/2027"
            error={form.formState.errors.label?.message}
            {...form.register('label')}
          />
          <InputField
            label="Data inizio"
            type="date"
            required
            error={form.formState.errors.startDate?.message}
            {...form.register('startDate')}
          />
          <InputField
            label="Data fine"
            type="date"
            required
            error={form.formState.errors.endDate?.message}
            {...form.register('endDate')}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...form.register('active')} />
            Imposta come anno attivo (disattiva gli altri)
          </label>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              Crea
            </button>
          </div>
        </form>
      ) : (
        <div className="card text-sm text-slate-500">
          Solo gli ADMIN possono creare/attivare anni accademici.
        </div>
      )}
    </div>
  );
}
