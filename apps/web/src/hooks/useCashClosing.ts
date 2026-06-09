import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { CashClosing, CashClosingDenomination } from '../types.js';

const CASH_CLOSING_KEYS = {
  all: ['cashClosings'] as const,
  byDate: (date: string) => [...CASH_CLOSING_KEYS.all, 'byDate', date] as const,
  byId: (id: string) => [...CASH_CLOSING_KEYS.all, 'byId', id] as const,
  last: () => [...CASH_CLOSING_KEYS.all, 'last'] as const,
  history: (yearId: string) => [...CASH_CLOSING_KEYS.all, 'history', yearId] as const,
};

export function useLastCashClosureDate() {
  return useQuery({
    queryKey: CASH_CLOSING_KEYS.last(),
    queryFn: () =>
      api<{ lastClosureDate: string | null }>('/api/cash-closings/last').then(
        (r) => r.lastClosureDate
      ),
  });
}

export function useExpectedCashForDate(date: string, yearId: string) {
  return useQuery({
    queryKey: ['expectedCash', date, yearId],
    queryFn: () =>
      api<{
        expectedCashFromMemberships: number;
        expectedCashFromCourses: number;
        totalExpenses: number;
        previousPettyCash: number;
        expectedCashTotal: number;
      }>(`/api/cash-closings/expected/${date}/${yearId}`),
    enabled: !!date && !!yearId,
  });
}

export function useCashClosing(date: string) {
  return useQuery({
    queryKey: CASH_CLOSING_KEYS.byDate(date),
    queryFn: () => api<CashClosing | null>(`/api/cash-closings/${date}`),
  });
}

export function useCashClosingHistory(yearId: string, limit = 20) {
  return useQuery({
    queryKey: CASH_CLOSING_KEYS.history(yearId),
    queryFn: () =>
      api<CashClosing[]>(
        `/api/cash-closings/history/${yearId}?limit=${limit}`
      ),
  });
}

export function useCreateCashClosing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      closureDate: string;
      academicYearId: string;
      countedCashTotal: number;
      pettyCashRemaining: number;
      bankDepositNumber?: string;
      bankDepositDate?: string;
      notes?: string;
      denominationCounts: CashClosingDenomination[];
    }) =>
      api<CashClosing>('/api/cash-closings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_CLOSING_KEYS.all });
    },
  });
}

export function useUpdateCashClosing(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<{
      closureDate: string;
      countedCashTotal: number;
      pettyCashRemaining: number;
      bankDepositNumber: string | null;
      bankDepositDate: string | null;
      notes: string | null;
      denominationCounts: CashClosingDenomination[];
    }>) =>
      api<CashClosing>(`/api/cash-closings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CASH_CLOSING_KEYS.all });
    },
  });
}
