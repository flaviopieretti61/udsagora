import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve essere lungo almeno 16 caratteri'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_EMAIL: z.string().email().default('admin@udsagora.local'),
  ADMIN_PASSWORD: z.string().min(6).default('cambiami'),
  ADMIN_NAME: z.string().default('Amministratore'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configurazione ambiente non valida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
