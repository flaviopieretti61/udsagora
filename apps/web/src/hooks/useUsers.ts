import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { UserRole } from '../types';

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
}

const KEY = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<{ users: AppUser[] }>('/api/users').then((r) => r.users),
  });
}

export interface UserInput {
  username: string;
  fullName: string;
  role: UserRole;
  password: string;
  active?: boolean;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UserInput) =>
      api<{ user: AppUser }>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: Partial<Omit<UserInput, 'password'>> & { id: string }) =>
      api<{ user: AppUser }>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api(`/api/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) =>
      api('/api/users/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  });
}
