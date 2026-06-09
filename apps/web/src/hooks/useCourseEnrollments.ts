import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CourseEnrollment, PaymentMethod } from '../types';

export function useEnrollmentsByCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-enrollments', { courseId }],
    enabled: !!courseId,
    queryFn: () =>
      api<{ items: CourseEnrollment[] }>(`/api/course-enrollments?courseId=${courseId}`).then(
        (r) => r.items,
      ),
  });
}

export function useEnrollmentsByMember(memberId: string | undefined) {
  return useQuery({
    queryKey: ['course-enrollments', { memberId }],
    enabled: !!memberId,
    queryFn: () =>
      api<{ items: CourseEnrollment[] }>(`/api/course-enrollments?memberId=${memberId}`).then(
        (r) => r.items,
      ),
  });
}

export interface EnrollmentInput {
  courseId: string;
  memberId: string;
  amountDueCents?: number;
  amountPaidCents?: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  note?: string;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['course-enrollments'] });
  qc.invalidateQueries({ queryKey: ['courses'] });
  qc.invalidateQueries({ queryKey: ['stats'] });
}

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EnrollmentInput) =>
      api<{ enrollment: CourseEnrollment; warning?: string }>('/api/course-enrollments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ enrollment: CourseEnrollment }>(`/api/course-enrollments/${id}/cancel`, {
        method: 'POST',
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useRestoreEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ enrollment: CourseEnrollment }>(`/api/course-enrollments/${id}/restore`, {
        method: 'POST',
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useEnrollmentPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      amountPaidCents: number;
      paymentDate?: string;
      paymentMethod?: PaymentMethod;
    }) =>
      api<{ enrollment: CourseEnrollment }>(`/api/course-enrollments/${id}/payment`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/course-enrollments/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}
