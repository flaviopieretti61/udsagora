import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AcademicYear } from '../types';

const KEY = ['academic-years'] as const;

export function useAcademicYears() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<{ years: AcademicYear[] }>('/api/academic-years').then((r) => r.years),
  });
}

export function useCurrentAcademicYear() {
  return useQuery({
    queryKey: [...KEY, 'current'],
    queryFn: () =>
      api<{ year: AcademicYear | null }>('/api/academic-years/current').then((r) => r.year),
  });
}

export interface AcademicYearInput {
  label: string;
  startDate: string;
  endDate: string;
  active?: boolean;
}

export function useCreateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AcademicYearInput) =>
      api<{ year: AcademicYear }>('/api/academic-years', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<AcademicYearInput> & { id: string }) =>
      api<{ year: AcademicYear }>(`/api/academic-years/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useActivateAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ year: AcademicYear }>(`/api/academic-years/${id}/activate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAcademicYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/academic-years/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
