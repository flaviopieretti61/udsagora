import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Course, CourseListResponse, CourseStatus } from '../types';

export interface CoursesFilter {
  academicYearId?: string;
  status?: CourseStatus;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'titolo' | 'year' | 'dataInizio' | 'status';
  sortOrder?: 'asc' | 'desc';
}

function toQuery(f: CoursesFilter): string {
  const sp = new URLSearchParams();
  if (f.academicYearId) sp.set('academicYearId', f.academicYearId);
  if (f.status) sp.set('status', f.status);
  if (f.q) sp.set('q', f.q);
  if (f.page) sp.set('page', String(f.page));
  if (f.pageSize) sp.set('pageSize', String(f.pageSize));
  if (f.sortBy) sp.set('sortBy', f.sortBy);
  if (f.sortOrder) sp.set('sortOrder', f.sortOrder);
  return sp.toString();
}

export function useCourses(filter: CoursesFilter) {
  const qs = toQuery(filter);
  return useQuery({
    queryKey: ['courses', filter],
    queryFn: () => api<CourseListResponse>(`/api/courses${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  });
}

export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: ['courses', 'detail', id],
    enabled: !!id,
    queryFn: () =>
      api<{ course: Course & { enrollments: unknown[] } }>(`/api/courses/${id}`).then(
        (r) => r.course,
      ),
  });
}

export interface CourseInput {
  academicYearId: string;
  codice?: string;
  titolo: string;
  descrizione?: string;
  docente?: string;
  costoCents: number;
  dataInizio: string;
  numeroSessioni: number;
  postiMassimi?: number | null;
  sede?: string;
  status?: CourseStatus;
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CourseInput) =>
      api<{ course: Course }>('/api/courses', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.course),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CourseInput> & { id: string }) =>
      api<{ course: Course }>(`/api/courses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => r.course),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['courses', 'detail', vars.id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
