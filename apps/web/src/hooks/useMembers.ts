import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  MemberDetail,
  MemberListResponse,
  MemberWriteInput,
  MembershipStatus,
  MembershipType,
} from '../types';

export interface MembersFilter {
  q?: string;
  categoryId?: string;
  membershipType?: MembershipType;
  membershipStatus?: MembershipStatus;
  academicYearId?: string;
  noMembership?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'cognome' | 'codiceFiscale' | 'category' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

function toQuery(f: MembersFilter): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  if (f.categoryId) sp.set('categoryId', f.categoryId);
  if (f.membershipType) sp.set('membershipType', f.membershipType);
  if (f.membershipStatus) sp.set('membershipStatus', f.membershipStatus);
  if (f.academicYearId) sp.set('academicYearId', f.academicYearId);
  if (f.noMembership) sp.set('noMembership', 'true');
  if (f.page) sp.set('page', String(f.page));
  if (f.pageSize) sp.set('pageSize', String(f.pageSize));
  if (f.sortBy) sp.set('sortBy', f.sortBy);
  if (f.sortDir) sp.set('sortDir', f.sortDir);
  return sp.toString();
}

export function useMembers(filter: MembersFilter) {
  const qs = toQuery(filter);
  return useQuery({
    queryKey: ['members', filter],
    queryFn: () => api<MemberListResponse>(`/api/members${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: ['members', 'detail', id],
    enabled: !!id,
    queryFn: () => api<{ member: MemberDetail }>(`/api/members/${id}`).then((r) => r.member),
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MemberWriteInput) =>
      api<{ member: MemberDetail }>('/api/members', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.member),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<MemberWriteInput> & { id: string }) =>
      api<{ member: MemberDetail }>(`/api/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => r.member),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['members', 'detail', vars.id] });
    },
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}
