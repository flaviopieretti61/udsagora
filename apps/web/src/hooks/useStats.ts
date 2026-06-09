import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { StatsOverview, MembershipsTimelinePoint } from '../types';

export function useStatsOverview() {
  return useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => api<StatsOverview>('/api/stats/overview'),
  });
}

export function useMembershipsTimeline() {
  return useQuery({
    queryKey: ['stats', 'memberships-timeline'],
    queryFn: () => api<MembershipsTimelinePoint[]>('/api/stats/memberships-timeline'),
  });
}
