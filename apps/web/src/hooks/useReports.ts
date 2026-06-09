import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { EnrollmentsDetailReport } from '../types';

export interface RevenueReport {
  academicYear: { id: string; label: string } | null;
  dateFrom: string | null;
  dateTo: string | null;
  memberships: {
    categoryId: string;
    categoryName: string;
    count: number;
    dueCents: number;
    paidCents: number;
  }[];
  pendingMemberships: {
    categoryId: string;
    categoryName: string;
    count: number;
    dueCents: number;
    paidCents: number;
  }[];
  courses: {
    courseId: string;
    titolo: string;
    status: string;
    count: number;
    dueCents: number;
    paidCents: number;
  }[];
  byPaymentMethod: {
    method: string;
    totalCents: number;
  }[];
  canceledEnrollments: {
    method: string;
    refundCents: number;
  }[];
  expenses?: {
    expenseDate: string;
    description: string;
    amountCents: number;
  }[];
  totals: {
    membershipsDueCents: number;
    membershipsPaidCents: number;
    pendingMembershipsDueCents: number;
    pendingMembershipsPaidCents: number;
    coursesDueCents: number;
    coursesPaidCents: number;
    grandPaidCents: number;
    grandDueCents: number;
    grandRefundCents: number;
    grandNetCents: number;
  } | null;
}

export function useRevenueReport(academicYearId?: string, dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (academicYearId) params.append('academicYearId', academicYearId);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  return useQuery({
    queryKey: ['reports', 'revenue', academicYearId, dateFrom, dateTo],
    queryFn: () =>
      api<RevenueReport>(`/api/reports/revenue${params.toString() ? '?' + params.toString() : ''}`),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

export function useEnrollmentsDetailReport(
  academicYearId?: string,
  dateFrom?: string,
  dateTo?: string,
  page: number = 1,
) {
  const params = new URLSearchParams();
  if (academicYearId) params.append('academicYearId', academicYearId);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', String(page));
  return useQuery({
    queryKey: ['reports', 'enrollments-detail', academicYearId, dateFrom, dateTo, page],
    queryFn: () =>
      api<EnrollmentsDetailReport>(
        `/api/reports/enrollments-detail${params.toString() ? '?' + params.toString() : ''}`,
      ),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}
