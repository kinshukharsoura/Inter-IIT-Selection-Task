import fs from 'node:fs';
import { z } from 'zod';

// Local development convenience: load ./.env if present (Docker/PaaS inject real env vars).
// Variables that are already set always win over the file.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const MIN_JWT_SECRET_LENGTH = 32;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z
    .string()
    .min(MIN_JWT_SECRET_LENGTH, `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`),
  JWT_EXPIRES_IN: z.string().default('1d'),
  /** Comma-separated list of allowed browser origins for CORS. */
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const corsOrigins = env.FRONTEND_URL.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
