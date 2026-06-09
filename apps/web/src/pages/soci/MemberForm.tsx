import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputField, SelectField, TextareaField } from '../../components/Field';
import { useCategories } from '../../hooks/useCategories';
import type { MemberDetail, MemberWriteInput } from '../../types';
import { toInputDate } from '../../lib/format';

const schema = z
  .object({
    cognome: z.string().trim().min(1, 'Obbligatorio'),
    nome: z.string().trim().min(1, 'Obbligatorio'),
    categoryId: z.string().min(1, 'Obbligatorio'),
    codiceFiscale: z.string().trim().toUpperCase().min(1, 'Obbligatorio'),
    dataNascita: z.string().min(1, 'Obbligatorio'),
    luogoNascita: z.string().trim().min(1, 'Obbligatorio'),
    gender: z.enum(['M', 'F', 'ALTRO'], {
      errorMap: () => ({ message: 'Obbligatorio' }),
    }),
    indirizzo: z.string().trim().min(1, 'Obbligatorio'),
    cap: z.string().trim().min(1, 'Obbligatorio'),
    citta: z.string().trim().min(1, 'Obbligatorio'),
    provincia: z.string().trim().min(1, 'Obbligatorio'),
    email: z.union([z.literal(''), z.string().email('Email non valida')]).optional(),
    telefono: z.string().optional().or(z.literal('')),
    cellulare: z.string().optional().or(z.literal('')),
    privacyFirmataIl: z.string().optional().or(z.literal('')),
    note: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.telefono || data.cellulare, {
    message: 'Inserisci almeno un numero di telefono (fisso o cellulare)',
    path: ['telefono'],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  initial?: MemberDetail;
  submitLabel?: string;
  onSubmit: (data: MemberWriteInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function MemberForm({ initial, submitLabel = 'Salva', onSubmit, onCancel }: Props) {
  const { data: categories } = useCategories();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cognome: initial?.cognome ?? '',
      nome: initial?.nome ?? '',
      categoryId: initial?.categoryId ?? '',
      codiceFiscale: initial?.codiceFiscale ?? '',
      dataNascita: toInputDate(initial?.dataNascita),
      luogoNascita: initial?.luogoNascita ?? '',
      gender: (initial?.gender as FormValues['gender']) ?? '',
      indirizzo: initial?.indirizzo ?? '',
      cap: initial?.cap ?? '',
      citta: initial?.citta ?? '',
      provincia: initial?.provincia ?? '',
      email: initial?.email ?? '',
      telefono: initial?.telefono ?? '',
      cellulare: initial?.cellulare ?? '',
      privacyFirmataIl: toInputDate(initial?.privacyFirmataIl),
      note: initial?.note ?? '',
    },
  });

  const submit: SubmitHandler<FormValues> = async (values) => {
    const payload: MemberWriteInput = {
      cognome: values.cognome,
      nome: values.nome,
      categoryId: values.categoryId,
      codiceFiscale: values.codiceFiscale || undefined,
      dataNascita: values.dataNascita || undefined,
      luogoNascita: values.luogoNascita || undefined,
      gender: values.gender ? (values.gender as 'M' | 'F' | 'ALTRO') : undefined,
      indirizzo: values.indirizzo || undefined,
      cap: values.cap || undefined,
      citta: values.citta || undefined,
      provincia: values.provincia || undefined,
      email: values.email || undefined,
      telefono: values.telefono || undefined,
      cellulare: values.cellulare || undefined,
      privacyFirmataIl: values.privacyFirmataIl || undefined,
      note: values.note || undefined,
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Errore' });
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Anagrafica</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Cognome"
            required
            error={errors.cognome?.message}
            {...register('cognome')}
          />
          <InputField label="Nome" required error={errors.nome?.message} {...register('nome')} />
          <InputField
            label="Codice fiscale"
            required
            placeholder="RSSMRA80A01H501Z"
            error={errors.codiceFiscale?.message}
            {...register('codiceFiscale')}
          />
          <SelectField
            label="Categoria"
            required
            error={errors.categoryId?.message}
            {...register('categoryId')}
          >
            <option value="">— Seleziona —</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Data di nascita"
            required
            type="date"
            error={errors.dataNascita?.message}
            {...register('dataNascita')}
          />
          <InputField
            label="Luogo di nascita"
            required
            error={errors.luogoNascita?.message}
            {...register('luogoNascita')}
          />
          <SelectField
            label="Genere"
            required
            error={errors.gender?.message}
            {...register('gender')}
          >
            <option value="">— Seleziona —</option>
            <option value="F">Femmina</option>
            <option value="M">Maschio</option>
            <option value="ALTRO">Altro</option>
          </SelectField>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Residenza</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Indirizzo"
            required
            className="md:col-span-2"
            error={errors.indirizzo?.message}
            {...register('indirizzo')}
          />
          <InputField
            label="CAP"
            required
            error={errors.cap?.message}
            {...register('cap')}
          />
          <InputField
            label="Città"
            required
            error={errors.citta?.message}
            {...register('citta')}
          />
          <InputField
            label="Provincia"
            required
            placeholder="MI"
            error={errors.provincia?.message}
            {...register('provincia')}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Contatti</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <InputField
            label="Telefono"
            hint="Obbligatorio se Cellulare non compilato"
            error={errors.telefono?.message}
            {...register('telefono')}
          />
          <InputField
            label="Cellulare"
            hint="Obbligatorio se Telefono non compilato"
            error={errors.cellulare?.message}
            {...register('cellulare')}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold text-slate-800 mb-4">Privacy e note</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Privacy firmata il"
            type="date"
            hint="Lascia vuoto se non ancora firmata"
            error={errors.privacyFirmataIl?.message}
            {...register('privacyFirmataIl')}
          />
          <TextareaField
            label="Note"
            className="md:col-span-2"
            error={errors.note?.message}
            {...register('note')}
          />
        </div>
      </section>

      {errors.root?.message && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annulla
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Salvataggio…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
