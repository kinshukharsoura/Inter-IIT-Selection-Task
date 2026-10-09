import { execSync } from 'node:child_process';
import { testEnv } from './testEnv';

/** Applies all migrations to the test database once before the integration suite. */
export default function setup(): void {
  const url = testEnv.DATABASE_URL;
  if (!url || !url.includes('test')) {
    throw new Error(
      `Refusing to run integration tests against "${url}". Set TEST_DATABASE_URL to a dedicated test database.`,
    );
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
