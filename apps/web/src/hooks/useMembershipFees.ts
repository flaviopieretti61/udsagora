import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MembershipFee, MembershipType } from '../types';

const KEY = ['membership-fees'] as const;

export function useMembershipFees(academicYearId?: string) {
  return useQuery({
    queryKey: [...KEY, academicYearId ?? 'all'],
    queryFn: () =>
      api<{ fees: MembershipFee[] }>(
        `/api/membership-fees${academicYearId ? `?academicYearId=${academicYearId}` : ''}`,
      ).then((r) => r.fees),
  });
}

export interface FeeInput {
  academicYearId: string;
  categoryId: string;
  type: MembershipType;
  amountCents: number;
}

export function useCreateFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FeeInput) =>
      api<{ fee: MembershipFee }>('/api/membership-fees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amountCents }: { id: string; amountCents: number }) =>
      api<{ fee: MembershipFee }>(`/api/membership-fees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amountCents }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/membership-fees/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
