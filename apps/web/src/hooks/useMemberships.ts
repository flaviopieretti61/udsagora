import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  Membership,
  MembershipListResponse,
  MembershipStatus,
  MembershipType,
  PaymentMethod,
} from '../types';

export interface MembershipsFilter {
  status?: MembershipStatus;
  type?: MembershipType;
  academicYearId?: string;
  memberId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'member' | 'year' | 'type' | 'status';
  sortOrder?: 'asc' | 'desc';
}

function toQuery(f: MembershipsFilter): string {
  const sp = new URLSearchParams();
  if (f.status) sp.set('status', f.status);
  if (f.type) sp.set('type', f.type);
  if (f.academicYearId) sp.set('academicYearId', f.academicYearId);
  if (f.memberId) sp.set('memberId', f.memberId);
  if (f.q) sp.set('q', f.q);
  if (f.page) sp.set('page', String(f.page));
  if (f.pageSize) sp.set('pageSize', String(f.pageSize));
  if (f.sortBy) sp.set('sortBy', f.sortBy);
  if (f.sortOrder) sp.set('sortOrder', f.sortOrder);
  return sp.toString();
}

export function useMemberships(filter: MembershipsFilter) {
  const qs = toQuery(filter);
  return useQuery({
    queryKey: ['memberships', filter],
    queryFn: () => api<MembershipListResponse>(`/api/memberships${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  });
}

export interface CreateMembershipInput {
  memberId: string;
  academicYearId: string;
  type: MembershipType;
  amountDueCents?: number;
  amountPaidCents?: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  note?: string;
}

function invalidate(qc: ReturnType<typeof useQueryClient>, memberId?: string) {
  qc.invalidateQueries({ queryKey: ['memberships'] });
  qc.invalidateQueries({ queryKey: ['stats'] });
  if (memberId) qc.invalidateQueries({ queryKey: ['members', 'detail', memberId] });
  qc.invalidateQueries({ queryKey: ['members'] });
}

export function useCreateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMembershipInput) =>
      api<{ membership: Membership }>('/api/memberships', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.membership),
    onSuccess: (m) => invalidate(qc, m.memberId),
  });
}

export function useUpdateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      type?: MembershipType;
      amountDueCents?: number;
      note?: string | null;
    }) =>
      api<{ membership: Membership }>(`/api/memberships/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => r.membership),
    onSuccess: (m) => invalidate(qc, m.memberId),
  });
}

export function useApproveMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ membership: Membership }>(`/api/memberships/${id}/approve`, {
        method: 'POST',
      }).then((r) => r.membership),
    onSuccess: (m) => invalidate(qc, m.memberId),
  });
}

export function useRejectMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api<{ membership: Membership }>(`/api/memberships/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason }),
      }).then((r) => r.membership),
    onSuccess: (m) => invalidate(qc, m.memberId),
  });
}

export function useCancelMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ membership: Membership }>(`/api/memberships/${id}/cancel`, {
        method: 'POST',
      }).then((r) => r.membership),
    onSuccess: (m) => invalidate(qc, m.memberId),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      amountPaidCents,
      paymentDate,
      paymentMethod,
    }: {
      id: string;
      amountPaidCents: number;
      paymentDate?: string;
      paymentMethod?: PaymentMethod;
    }) =>
      api<{ membership: Membership }>(`/api/memberships/${id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amountPaidCents, paymentDate, paymentMethod }),
      }).then((r) => r.membership),
    onSuccess: (m) => invalidate(qc, m.memberId),
  });
}

export function useDeleteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/memberships/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}
