import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validazione fallita', issues: err.flatten() });
    return;
  }
  if (err instanceof Error) {
    console.error('[API error]', err);
    res.status(500).json({ error: err.message });
    return;
  }
  console.error('[API error] unknown', err);
  res.status(500).json({ error: 'Errore interno' });
}
