import fs from 'node:fs';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

/**
 * Environment for the integration suite. Tests run against a dedicated database
 * (TEST_DATABASE_URL) because every test truncates all tables.
 */
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    'postgresql://recipes:recipes@localhost:5432/recipes_test?schema=public',
  JWT_SECRET: 'test-only-jwt-secret-with-at-least-32-characters',
  JWT_EXPIRES_IN: '1h',
  BCRYPT_SALT_ROUNDS: '4',
  FRONTEND_URL: 'http://localhost:5173',
};
