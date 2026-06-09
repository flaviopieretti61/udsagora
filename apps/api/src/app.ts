import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import categoryRoutes from './routes/categories.js';
import academicYearRoutes from './routes/academic-years.js';
import memberRoutes from './routes/members.js';
import membershipFeeRoutes from './routes/membership-fees.js';
import membershipRoutes from './routes/memberships.js';
import courseRoutes from './routes/courses.js';
import courseEnrollmentRoutes from './routes/course-enrollments.js';
import reportRoutes from './routes/reports.js';
import auditLogRoutes from './routes/audit-log.js';
import userRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';
import expenseRoutes from './routes/expenses.js';
import cashClosingRoutes from './routes/cash-closings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // In produzione l'app gira dietro il proxy di Render: senza trust proxy
  // tutti i client risulterebbero con lo stesso IP (quello del proxy) e il
  // rate limiter li tratterebbe come un'unica origine. Fidiamoci del primo hop.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/academic-years', academicYearRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/membership-fees', membershipFeeRoutes);
  app.use('/api/memberships', membershipRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/course-enrollments', courseEnrollmentRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit-log', auditLogRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/cash-closings', cashClosingRoutes);

  // In produzione (NODE_ENV=production) serviamo anche il frontend buildato.
  // In sviluppo è Vite a servirlo su porta separata con HMR.
  if (process.env.NODE_ENV === 'production') {
    // __dirname punta a apps/api/dist/ → ../../web/dist è apps/web/dist
    const webDist = path.resolve(__dirname, '../../web/dist');
    app.use(express.static(webDist));
    // Fallback per le rotte React Router (qualsiasi GET non-/api restituisce index.html)
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
