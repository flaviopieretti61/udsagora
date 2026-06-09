import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputField, SelectField, TextareaField } from '../../components/Field';
import { useAcademicYears } from '../../hooks/useAcademicYears';
import { centsToEuros, eurosToCents, toInputDate } from '../../lib/format';
import type { Course, CourseStatus } from '../../types';
import type { CourseInput } from '../../hooks/useCourses';

const STATUSES: CourseStatus[] = ['IN_PREPARAZIONE', 'APERTO', 'CHIUSO', 'ANNULLATO'];

const schema = z.object({
  academicYearId: z.string().min(1, 'Obbligatorio'),
  codice: z.string().optional().or(z.literal('')),
  titolo: z.string().trim().min(1, 'Obbligatorio'),
  descrizione: z.string().optional().or(z.literal('')),
  docente: z.string().optional().or(z.literal('')),
  costoEuros: z.string().min(1, 'Obbligatorio'),
  dataInizio: z.string().min(1, 'Obbligatorio'),
  numeroSessioni: z.coerce.number().int().positive('Almeno 1'),
  postiMassimi: z
    .union([z.literal(''), z.coerce.number().int().positive()])
    .optional(),
  sede: z.string().optional().or(z.literal('')),
  status: z.enum(['IN_PREPARAZIONE', 'APERTO', 'CHIUSO', 'ANNULLATO']),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  initial?: Course;
  submitLabel?: string;
  onSubmit: (data: CourseInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function CourseForm({ initial, submitLabel = 'Salva', onSubmit, onCancel }: Props) {
  const { data: years } = useAcademicYears();
  const activeYear = years?.find((y) => y.active);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      academicYearId: initial?.academicYearId ?? activeYear?.id ?? '',
      codice: initial?.codice ?? '',
      titolo: initial?.titolo ?? '',
      descrizione: initial?.descrizione ?? '',
      docente: initial?.docente ?? '',
      costoEuros: initial ? centsToEuros(initial.costoCents) : '',
      dataInizio: toInputDate(initial?.dataInizio),
      numeroSessioni: initial?.numeroSessioni ?? 1,
      postiMassimi: initial?.postiMassimi ?? '',
      sede: initial?.sede ?? '',
      status: initial?.status ?? 'IN_PREPARAZIONE',
    },
  });

  async function handle(values: FormValues) {
    const cents = eurosToCents(values.costoEuros);
    if (cents === null) {
      form.setError('costoEuros', { message: 'Importo non valido' });
      return;
    }
    const payload: CourseInput = {
      academicYearId: values.academicYearId,
      codice: values.codice || undefined,
      titolo: values.titolo,
      descrizione: values.descrizione || undefined,
      docente: values.docente || undefined,
      costoCents: cents,
      dataInizio: values.dataInizio,
      numeroSessioni: values.numeroSessioni,
      postiMassimi: values.postiMassimi === '' ? null : (values.postiMassimi as number),
      sede: values.sede || undefined,
      status: values.status,
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      form.setError('root', { message: err instanceof Error ? err.message : 'Errore' });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handle)} className="space-y-6">
      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Anagrafica corso</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label="Anno accademico"
            required
            error={form.formState.errors.academicYearId?.message}
            {...form.register('academicYearId')}
          >
            <option value="">— Seleziona —</option>
            {years?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.active ? ' (attivo)' : ''}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Codice (opzionale)"
            placeholder="CORSO-2026-A"
            error={form.formState.errors.codice?.message}
            {...form.register('codice')}
          />
          <InputField
            label="Titolo"
            required
            className="md:col-span-2"
            error={form.formState.errors.titolo?.message}
            {...form.register('titolo')}
          />
          <TextareaField
            label="Descrizione"
            className="md:col-span-2"
            error={form.formState.errors.descrizione?.message}
            {...form.register('descrizione')}
          />
          <InputField
            label="Docente"
            error={form.formState.errors.docente?.message}
            {...form.register('docente')}
          />
          <InputField
            label="Sede"
            error={form.formState.errors.sede?.message}
            {...form.register('sede')}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Logistica e costi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Data inizio"
            type="date"
            required
            error={form.formState.errors.dataInizio?.message}
            {...form.register('dataInizio')}
          />
          <InputField
            label="Numero di sessioni"
            type="number"
            required
            min={1}
            error={form.formState.errors.numeroSessioni?.message}
            {...form.register('numeroSessioni')}
          />
          <InputField
            label="Costo (€)"
            required
            placeholder="0,00"
            inputMode="decimal"
            error={form.formState.errors.costoEuros?.message}
            {...form.register('costoEuros')}
          />
          <InputField
            label="Posti massimi (lasciare vuoto = illimitati)"
            type="number"
            min={1}
            error={form.formState.errors.postiMassimi?.message}
            {...form.register('postiMassimi')}
          />
          <SelectField
            label="Stato"
            error={form.formState.errors.status?.message}
            {...form.register('status')}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {form.formState.errors.root?.message && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {form.formState.errors.root.message}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annulla
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvataggio…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
