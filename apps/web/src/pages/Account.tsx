import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../components/PageHeader';
import { InputField } from '../components/Field';
import { useChangeOwnPassword } from '../hooks/useUsers';
import { useAuth } from '../auth/AuthContext';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Obbligatorio'),
    newPassword: z.string().min(6, 'Almeno 6 caratteri'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Le due password non coincidono',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export function AccountPage() {
  const { user } = useAuth();
  const change = useChangeOwnPassword();
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  async function submit(values: FormValues) {
    setMessage(null);
    try {
      await change.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage('Password aggiornata correttamente.');
    } catch (err) {
      form.setError('root', { message: err instanceof Error ? err.message : 'Errore' });
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <PageHeader title="Il mio account" subtitle="Dati personali e cambio password" />

      <div className="card mb-4 space-y-1 text-sm">
        <div>
          <span className="text-slate-500">Nome:</span> {user?.fullName}
        </div>
        <div>
          <span className="text-slate-500">Username:</span> {user?.username}
        </div>
        <div>
          <span className="text-slate-500">Ruolo:</span> {user?.role}
        </div>
      </div>

      <form onSubmit={form.handleSubmit(submit)} className="card space-y-3">
        <h2 className="font-semibold text-slate-800">Cambia password</h2>
        <InputField
          label="Password attuale"
          type="password"
          required
          error={form.formState.errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
        <InputField
          label="Nuova password"
          type="password"
          required
          hint="Almeno 6 caratteri"
          error={form.formState.errors.newPassword?.message}
          {...form.register('newPassword')}
        />
        <InputField
          label="Conferma nuova password"
          type="password"
          required
          error={form.formState.errors.confirm?.message}
          {...form.register('confirm')}
        />
        {form.formState.errors.root?.message && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {form.formState.errors.root.message}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvataggio…' : 'Cambia password'}
          </button>
        </div>
      </form>
    </div>
  );
}
