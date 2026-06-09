// Utility per risposte JSON e gestione errori comuni.

import { Prisma } from '@prisma/client';
import type { Response } from 'express';

export function handlePrismaError(err: unknown, res: Response): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      res.status(409).json({ error: `Valore duplicato su ${target}` });
      return true;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'Esistono record collegati: impossibile eliminare' });
      return true;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record non trovato' });
      return true;
    }
  }
  return false;
}
