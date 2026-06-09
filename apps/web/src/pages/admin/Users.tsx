import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/Field';
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
  type AppUser,
} from '../../hooks/useUsers';
import { useAuth } from '../../auth/AuthContext';
import type { UserRole } from '../../types';

const createSchema = z.object({
  username: z.string().trim().min(1, 'Username obbligatorio'),
  fullName: z.string().trim().min(1),
  role: z.enum(['ADMIN', 'CONSIGLIO', 'SEGRETERIA']),
  password: z.string().min(6, 'Almeno 6 caratteri'),
});
type CreateForm = z.infer<typeof createSchema>;

export function UsersAdminPage() {
  const { user: me } = useAuth();
  const { data: users, isLoading } = useUsers();
  const create = useCreateUser();
  const update = useUpdateUser();
  const del = useDeleteUser();
  const resetPwd = useResetUserPassword();

  const [createOpen, setCreateOpen] = useState(false);
  const [pwdFor, setPwdFor] = useState<AppUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggleActive(u: AppUser) {
    setErr(null);
    try {
      await update.mutateAsync({ id: u.id, active: !u.active });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function changeRole(u: AppUser, role: UserRole) {
    setErr(null);
    try {
      await update.mutateAsync({ id: u.id, role });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  async function handleDelete(u: AppUser) {
    if (!confirm(`Eliminare l'utente ${u.fullName}?`)) return;
    setErr(null);
    try {
      await del.mutateAsync(u.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title="Utenti applicativi"
        subtitle="Account di segreteria, consiglio, amministratori"
        actions={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            + Nuovo utente
          </button>
        }
      />
      {err && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Caricamento…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Username</th>
                <th className="text-left px-4 py-3 font-medium">Ruolo</th>
                <th className="text-left px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users?.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {u.fullName}
                    {u.id === me?.id && (
                      <span className="ml-2 text-xs text-slate-400">(tu)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.username}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as UserRole)}
                      className="input py-1 text-xs"
                    >
                      <option value="SEGRETERIA">SEGRETERIA</option>
                      <option value="CONSIGLIO">CONSIGLIO</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? <Badge tone="green">Attivo</Badge> : <Badge tone="red">Disattivato</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm space-x-3 whitespace-nowrap">
                    <button
                      className="text-brand-700 hover:underline"
                      onClick={() => setPwdFor(u)}
                    >
                      Reset password
                    </button>
                    {u.id !== me?.id && (
                      <button
                        className="text-slate-600 hover:underline"
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? 'Disattiva' : 'Riattiva'}
                      </button>
                    )}
                    {u.id !== me?.id && (
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleDelete(u)}
                      >
                        Elimina
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (data) => {
          await create.mutateAsync(data);
          setCreateOpen(false);
        }}
      />
      <ResetPasswordModal
        open={!!pwdFor}
        user={pwdFor}
        onClose={() => setPwdFor(null)}
        onSubmit={async (password) => {
          if (!pwdFor) return;
          await resetPwd.mutateAsync({ id: pwdFor.id, password });
          setPwdFor(null);
        }}
      />
    </div>
  );
}

function CreateUserModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateForm) => Promise<unknown>;
}) {
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { username: '', fullName: '', role: 'SEGRETERIA', password: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(values: CreateForm) {
    setErr(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
      form.reset({ username: '', fullName: '', role: 'SEGRETERIA', password: '' });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        form.reset({ username: '', fullName: '', role: 'SEGRETERIA', password: '' });
        setErr(null);
        onClose();
      }}
      title="Nuovo utente applicativo"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              form.reset({ username: '', fullName: '', role: 'SEGRETERIA', password: '' });
              setErr(null);
              onClose();
            }}
          >
            Annulla
          </button>
          <button className="btn-primary" onClick={form.handleSubmit(submit)} disabled={submitting}>
            {submitting ? 'Creazione…' : 'Crea'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <InputField
          label="Nome completo"
          required
          error={form.formState.errors.fullName?.message}
          {...form.register('fullName')}
        />
        <InputField
          label="Username"
          type="text"
          required
          error={form.formState.errors.username?.message}
          {...form.register('username')}
        />
        <SelectField
          label="Ruolo"
          required
          error={form.formState.errors.role?.message}
          {...form.register('role')}
        >
          <option value="SEGRETERIA">SEGRETERIA</option>
          <option value="CONSIGLIO">CONSIGLIO</option>
          <option value="ADMIN">ADMIN</option>
        </SelectField>
        <InputField
          label="Password iniziale"
          type="password"
          required
          hint="L'utente potrà cambiarla dopo il login"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  open,
  user,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: AppUser | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<unknown>;
}) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (password.length < 6) {
      setErr('Almeno 6 caratteri');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit(password);
      setPassword('');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Errore');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setPassword('');
        setErr(null);
        onClose();
      }}
      title={`Reset password ${user?.fullName ?? ''}`}
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              setPassword('');
              setErr(null);
              onClose();
            }}
          >
            Annulla
          </button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Salvataggio…' : 'Imposta password'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Imposta una nuova password per <strong>{user?.fullName}</strong>. Comunicagliela in modo
          sicuro: dovrà cambiarla al primo accesso.
        </p>
        <InputField
          label="Nuova password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={err ?? undefined}
        />
      </div>
    </Modal>
  );
}
