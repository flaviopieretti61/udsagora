import type { MembershipStatus } from '../../types';

export function statusLabel(s: MembershipStatus): string {
  return s.replace('_', ' ').toLowerCase();
}

export function statusTone(s: MembershipStatus): 'green' | 'amber' | 'red' | 'slate' {
  switch (s) {
    case 'APPROVATA':
      return 'green';
    case 'IN_ATTESA':
      return 'amber';
    case 'RIFIUTATA':
    case 'ANNULLATA':
      return 'red';
    default:
      return 'slate';
  }
}
