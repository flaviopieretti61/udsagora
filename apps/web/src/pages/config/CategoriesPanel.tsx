import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputField, TextareaField } from '../../components/Field';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryInput,
} from '../../hooks/useCategories';
import { useAuth } from '../../auth/AuthContext';

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Obbligatorio')
    .regex(/^[A-Z0-9_]+$/, 'Solo A-Z, 0-9, _'),
  name: z.string().trim().min(1, 'Obbligatorio'),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CategoriesPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data: categories, isLoading } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const editing = categories?.find((c) => c.id === editingId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', notes: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const payload: CategoryInput = {
        code: values.code,
        name: values.name,
        notes: values.notes || undefined,
      };
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      form.reset({ code: '', name: '', notes: '' });
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore');
    }
  }

  function startEdit(id: string) {
    const c = categories?.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    form.reset({ code: c.code, name: c.name, notes: c.notes ?? '' });
  }

  function cancelEdit() {
    setEditingId(null);
    form.reset({ code: '', name: '', notes: '' });
    setFormError(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare la categoria "${name}"?`)) return;
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
                <th className="text-left px-4 py-3 font-medium">Codice</th>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-right px-4 py-3 font-medium">Soci</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories?.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.membersCount ?? 0}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        className="text-sm text-brand-700 hover:underline"
                        onClick={() => startEdit(c.id)}
                      >
                        Modifica
                      </button>
                      <button
                        className="text-sm text-red-600 hover:underline disabled:opacity-40"
                        disabled={(c.membersCount ?? 0) > 0}
                        title={
                          (c.membersCount ?? 0) > 0
                            ? 'Categoria in uso da soci'
                            : 'Elimina categoria'
                        }
                        onClick={() => handleDelete(c.id, c.name)}
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
          <h3 className="font-semibold text-slate-800">
            {editing ? 'Modifica categoria' : 'Nuova categoria'}
          </h3>
          <InputField
            label="Codice"
            required
            placeholder="ORDINARIO"
            error={form.formState.errors.code?.message}
            {...form.register('code')}
          />
          <InputField
            label="Nome"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <TextareaField
            label="Note"
            error={form.formState.errors.notes?.message}
            {...form.register('notes')}
          />
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="flex justify-end gap-2">
            {editing && (
              <button type="button" className="btn-secondary" onClick={cancelEdit}>
                Annulla
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              {editing ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      ) : (
        <div className="card text-sm text-slate-500">
          Solo gli ADMIN possono creare/modificare categorie.
        </div>
      )}
    </div>
  );
}
