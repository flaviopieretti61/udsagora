import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

export interface AuditLogResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AuditLogEntry[];
}

export interface AuditLogFilter {
  userId?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLog(filter: AuditLogFilter) {
  const sp = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  });
  return useQuery({
    queryKey: ['audit-log', filter],
    queryFn: () =>
      api<AuditLogResponse>(`/api/audit-log${sp.toString() ? `?${sp.toString()}` : ''}`),
    placeholderData: (prev) => prev,
  });
}
