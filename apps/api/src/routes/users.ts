import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { handlePrismaError } from '../lib/http.js';
import { userRoleSchema } from '../types/enums.js';

const router = Router();
router.use(requireAuth);

// -- Schemi ----------------------------------------------------------------

const createSchema = z.object({
  username: z.string().trim().min(1).max(120),
  fullName: z.string().trim().min(1).max(120),
  role: userRoleSchema,
  password: z.string().min(6),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  username: z.string().trim().min(1).max(120).optional(),
  fullName: z.string().trim().min(1).max(120).optional(),
  role: userRoleSchema.optional(),
  active: z.boolean().optional(),
});

const setPasswordSchema = z.object({
  password: z.string().min(6),
});

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// -- Endpoint propri (qualsiasi utente autenticato) ------------------------

// POST /api/users/me/password — cambio password proprio
router.post('/me/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changeOwnPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'Password attuale non corretta' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await audit({
      userId: user.id,
      action: 'USER_OWN_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// -- Endpoint amministrativi (solo ADMIN) ----------------------------------
router.use(requireRole('ADMIN'));

// GET /api/users
router.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const created = await prisma.user.create({
      data: {
        username: data.username,
        fullName: data.fullName,
        role: data.role,
        passwordHash,
        active: data.active ?? true,
      },
      select: { id: true, username: true, fullName: true, role: true, active: true },
    });
    await audit({
      userId: req.user!.userId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: created.id,
      payload: { username: data.username, role: data.role },
    });
    res.status(201).json({ user: created });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    if (data.active === false && req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'Non puoi disattivare il tuo stesso account' });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, fullName: true, role: true, active: true },
    });
    await audit({
      userId: req.user!.userId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updated.id,
      payload: data,
    });
    res.json({ user: updated });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// POST /api/users/:id/password — reset password (admin)
router.post('/:id/password', async (req, res, next) => {
  try {
    const { password } = setPasswordSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    await audit({
      userId: req.user!.userId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
      return;
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    await audit({
      userId: req.user!.userId,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) {
    if (handlePrismaError(err, res)) return;
    next(err);
  }
});

export default router;

