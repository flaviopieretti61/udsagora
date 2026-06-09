// SQLite non supporta enum nativi: definiamo qui le union dei valori ammessi
// e i corrispondenti schemi Zod per validare gli input al boundary HTTP.

import { z } from 'zod';

export const USER_ROLES = ['ADMIN', 'CONSIGLIO', 'SEGRETERIA'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const MEMBERSHIP_TYPES = ['NUOVA', 'RINNOVO'] as const;
export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];
export const membershipTypeSchema = z.enum(MEMBERSHIP_TYPES);

export const MEMBERSHIP_STATUSES = ['IN_ATTESA', 'APPROVATA', 'RIFIUTATA', 'ANNULLATA'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export const membershipStatusSchema = z.enum(MEMBERSHIP_STATUSES);

export const GENDERS = ['M', 'F', 'ALTRO'] as const;
export type Gender = (typeof GENDERS)[number];
export const genderSchema = z.enum(GENDERS);

export const PAYMENT_METHODS = ['CONTANTI', 'BONIFICO', 'POS', 'ALTRO'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const COURSE_STATUSES = ['IN_PREPARAZIONE', 'APERTO', 'CHIUSO', 'ANNULLATO'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const courseStatusSchema = z.enum(COURSE_STATUSES);

export const ENROLLMENT_STATUSES = ['ATTIVA', 'ANNULLATA'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export const enrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES);
