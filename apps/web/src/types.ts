// Tipi condivisi lato frontend, allineati con i DTO del backend.

export type UserRole = 'ADMIN' | 'CONSIGLIO' | 'SEGRETERIA';
export type Gender = 'M' | 'F' | 'ALTRO';
export type MembershipType = 'NUOVA' | 'RINNOVO';
export type MembershipStatus = 'IN_ATTESA' | 'APPROVATA' | 'RIFIUTATA' | 'ANNULLATA';
export type PaymentMethod = 'CONTANTI' | 'BONIFICO' | 'POS' | 'ALTRO';
export type CourseStatus = 'IN_PREPARAZIONE' | 'APERTO' | 'CHIUSO' | 'ANNULLATO';
export type EnrollmentStatus = 'ATTIVA' | 'ANNULLATA';

export interface Category {
  id: string;
  code: string;
  name: string;
  notes?: string | null;
  membersCount?: number;
}

export interface AcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  active: boolean;
  membershipsCount?: number;
  coursesCount?: number;
}

export interface MemberListItem {
  id: string;
  cognome: string;
  nome: string;
  codiceFiscale?: string | null;
  email?: string | null;
  telefono?: string | null;
  cellulare?: string | null;
  category: { id: string; code: string; name: string };
  currentMembership: { id: string; type: MembershipType; status: MembershipStatus } | null;
  createdAt: string;
}

export interface MemberListResponse {
  total: number;
  page: number;
  pageSize: number;
  academicYearId: string | null;
  items: MemberListItem[];
}

export interface MemberDetail {
  id: string;
  cognome: string;
  nome: string;
  codiceFiscale?: string | null;
  dataNascita?: string | null;
  luogoNascita?: string | null;
  gender?: Gender | null;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  email?: string | null;
  telefono?: string | null;
  cellulare?: string | null;
  categoryId: string;
  category: Category;
  privacyFirmataIl?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  memberships?: unknown[];
  courseEnrollments?: unknown[];
}

export interface MemberWriteInput {
  cognome: string;
  nome: string;
  codiceFiscale?: string;
  dataNascita?: string;
  luogoNascita?: string;
  gender?: Gender;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  email?: string;
  telefono?: string;
  cellulare?: string;
  categoryId: string;
  privacyFirmataIl?: string;
  note?: string;
}

export interface StatsOverview {
  currentYear: { id: string; label: string } | null;
  totalMembers: number;
  pendingMemberships: number;
  activeCourses: number;
  newMemberships: number;
  renewalMemberships: number;
  totalCourseParticipants: number;
}

export interface MembershipsTimelinePoint {
  date: string;
  nuova: number;
  rinnovo: number;
  totale: number;
}

export interface Expense {
  id: string;
  expenseDate: string;
  description: string;
  spenderName: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
  user?: { username: string; fullName: string };
}

export interface CashClosingDenomination {
  denominationCents: number;
  quantity: number;
  subtotal: number;
}

export interface CashClosing {
  id: string;
  closureDate: string;
  academicYearId: string;
  expectedCashFromMemberships: number;
  expectedCashFromCourses: number;
  expectedCashFromOther: number;
  expensesTotal: number;
  previousPettyCash: number;
  countedCashTotal: number;
  pettyCashRemaining: number;
  bankDepositAmount: number;
  bankDepositNumber?: string | null;
  bankDepositDate?: string | null;
  difference: number;
  notes?: string | null;
  denominationCounts: CashClosingDenomination[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipFee {
  id: string;
  academicYearId: string;
  categoryId: string;
  type: MembershipType;
  amountCents: number;
  category?: { id: string; code: string; name: string };
  academicYear?: { id: string; label: string };
}

export interface Membership {
  id: string;
  memberId: string;
  academicYearId: string;
  type: MembershipType;
  status: MembershipStatus;
  amountDueCents: number;
  amountPaidCents: number;
  paymentDate?: string | null;
  paymentMethod?: PaymentMethod | null;
  receiptNumber?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipListItem extends Membership {
  member: {
    id: string;
    cognome: string;
    nome: string;
    category: { id: string; code: string; name: string };
  };
  academicYear: { id: string; label: string };
  approvedBy?: { id: string; fullName: string } | null;
}

export interface MembershipListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: MembershipListItem[];
}

export interface Course {
  id: string;
  academicYearId: string;
  codice?: string | null;
  titolo: string;
  descrizione?: string | null;
  docente?: string | null;
  costoCents: number;
  dataInizio: string;
  numeroSessioni: number;
  postiMassimi?: number | null;
  sede?: string | null;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  academicYear?: { id: string; label: string };
  iscrittiAttivi?: number;
}

export interface CourseListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: Course[];
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  memberId: string;
  amountDueCents: number;
  amountPaidCents: number;
  paymentDate?: string | null;
  paymentMethod?: PaymentMethod | null;
  receiptNumber?: string | null;
  status: EnrollmentStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  member?: {
    id: string;
    cognome: string;
    nome: string;
    codiceFiscale?: string | null;
    email?: string | null;
    category: { id: string; code: string; name: string };
  };
  course?: Course;
}

export interface EnrollmentsDetailReport {
  academicYear: { id: string; label: string } | null;
  dateFrom: string | null;
  dateTo: string | null;

  // Sezione 1: Iscrizioni tessere
  memberships: {
    member: { id: string; cognome: string; nome: string };
    createdAt: string;
    type: MembershipType;
    status: MembershipStatus;
    amountDueCents: number;
    amountPaidCents: number;
    paymentMethod: PaymentMethod | null;
  }[];

  membershipsSummary: {
    type: MembershipType;
    status: MembershipStatus;
    paymentMethod: PaymentMethod | null;
    count: number;
    totalDueCents: number;
    totalPaidCents: number;
  }[];

  membershipsPagination: {
    page: number;
    pageSize: number;
    total: number;
  };

  // Sezione 2: Iscrizioni ai corsi
  courseEnrollments: {
    member: { id: string; cognome: string; nome: string };
    course: { id: string; titolo: string };
    createdAt: string;
    status: EnrollmentStatus;
    amountDueCents: number;
    amountPaidCents: number;
    paymentMethod: PaymentMethod | null;
  }[];

  courseEnrollmentsSummary: {
    status: EnrollmentStatus;
    paymentMethod: PaymentMethod | null;
    count: number;
    totalDueCents: number;
    totalPaidCents: number;
  }[];

  courseEnrollmentsPagination: {
    page: number;
    pageSize: number;
    total: number;
  };

  // Sezione 3: Riepilogo incassi
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

  // Totali
  totals: {
    membershipsDueCents: number;
    membershipsPaidCents: number;
    courseEnrollmentsDueCents: number;
    courseEnrollmentsPaidCents: number;
    grandPaidCents: number;
  };
}
