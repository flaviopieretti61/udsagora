import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rate-limit.js';
import { audit } from '../lib/audit.js';
import type { UserRole } from '../types/enums.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (!user || !user.active) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }
    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
    });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // LAN interna: niente HTTPS richiesto
      // Session cookie: deleted when browser closes (no maxAge)
    });

    // Log login event
    await audit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      payload: { username: user.username, role: user.role },
    });

    res.json({
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    // Extract user from token if available (optional logging)
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = await new Promise((resolve, reject) => {
          const jwt = require('jsonwebtoken');
          jwt.verify(token, process.env.JWT_SECRET || '', (err: any, decoded: any) => {
            if (err) reject(err);
            else resolve(decoded);
          });
        }) as any;

        // Log logout event
        await audit({
          userId: decoded.userId,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: decoded.userId,
          payload: { username: decoded.username, role: decoded.role },
        });
      } catch {
        // Token invalid or expired, logout anyway
      }
    }
    res.clearCookie('token');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, fullName: true, role: true, active: true },
    });
    if (!user || !user.active) {
      res.status(401).json({ error: 'Utente non trovato' });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;

