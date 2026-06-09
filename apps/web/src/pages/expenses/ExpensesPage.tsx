import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../components/PageHeader.js';
import { InputField } from '../../components/Field.js';
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from '../../hooks/useExpenses.js';
import { toInputDate, formatDate, centsToEuros, eurosToCents } from '../../lib/format.js';
import type { Expense } from '../../types.js';

const schema = z.object({
  expenseDate: z.string().min(1, 'Data obbligatoria'),
  description: z.string().min(1, 'Descrizione obbligatoria').max(500),
  spenderName: z.string().min(1, 'Nome spenditore obbligatorio'),
  amountEuros: z
    .string()
    .min(1, 'Importo obbligatorio')
    .refine((val) => {
      const cents = eurosToCents(val);
      return cents !== null && cents > 0;
    }, 'Importo deve essere > 0'),
});

type FormData = z.infer<typeof schema>;

export function ExpensesPage() {
  const { data: expenses = [], isLoading } = useExpenses();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const del = useDeleteExpense();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      expenseDate: toInputDate(new Date().toISOString()),
      description: '',
      spenderName: '',
      amountEuros: '',
    },
  });

  async function onSubmit(data: FormData) {
    try {
      const amountCents = eurosToCents(data.amountEuros);
      if (amountCents === null) {
        setError('amountEuros', { message: 'Importo non valido' });
        return;
      }

      const payload = {
        expenseDate: `${data.expenseDate}T00:00:00Z`,
        description: data.description,
        spenderName: data.spenderName,
        amountCents,
      };

      if (editingId && editingExpense) {
        await update.mutateAsync({ id: editingId, data: payload });
        setEditingId(null);
        setEditingExpense(null);
      } else {
        await create.mutateAsync(payload);
      }

      reset();
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Errore durante il salvataggio';
      setError('root', { message: error });
    }
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditingExpense(expense);
    setValue('expenseDate', toInputDate(expense.expenseDate));
    setValue('description', expense.description);
    setValue('spenderName', expense.spenderName);
    setValue('amountEuros', centsToEuros(expense.amountCents));
  }

  async function handleDelete(id: string, description: string) {
    if (!window.confirm(`Eliminare spesa "${description}"?`)) return;
    try {
      await del.mutateAsync(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingExpense(null);
    reset();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8">
        <PageHeader title="Spese e Differenze di Cassa" subtitle="Gestione spese e differenze di cassa dell'associazione" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FORM COLONNA SINISTRA */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? 'Modifica Registrazione' : 'Registrazione Spesa o Differenze'}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <InputField
                label="Data"
                type="date"
                {...register('expenseDate')}
                error={errors.expenseDate?.message}
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descrizione *
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="input w-full"
                  placeholder="Descrizione spesa o differenza"
                />
                {errors.description && (
                  <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>
                )}
              </div>

              <InputField
                label="Nome Utente"
                {...register('spenderName')}
                error={errors.spenderName?.message}
              />

              <InputField
                label="Importo (€)"
                type="text"
                placeholder="0,00"
                {...register('amountEuros')}
                error={errors.amountEuros?.message}
              />

              {errors.root && (
                <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
                  {errors.root.message}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Salva'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* LISTA COLONNA DESTRA */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">
              Spese e Differenze Registrate ({expenses.length})
            </h2>

            {isLoading ? (
              <p className="text-slate-600">Caricamento...</p>
            ) : expenses.length === 0 ? (
              <p className="text-slate-600">Nessuna spesa registrata</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="border border-slate-200 rounded p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm text-slate-600">
                          {formatDate(expense.expenseDate)}
                        </p>
                        <p className="font-medium text-slate-900">{expense.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{expense.spenderName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          {centsToEuros(expense.amountCents)} €
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
                      <button
                        onClick={() => startEdit(expense)}
                        className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id, expense.description)}
                        className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-8 py-4 text-center text-sm text-slate-600">
        <div>
          Copyright © Unisaperi - Università dei Saperi Giulio Grimaldi<br />
          Via Arco d'Augusto, 81 (ex tribunale) primo piano | 61032 Fano (PU) | CF 90025870412
        </div>
        <div className="mt-2 text-slate-500">
          Powered by Pejo61
        </div>
      </footer>
    </div>
  );
}
