import { defineConfig } from 'vitest/config';
import { testEnv } from './tests/integration/testEnv';

export default defineConfig({
  test: {
    // Integration files share one database, so test files run one at a time
    // (the per-project option is not honoured when several projects are defined).
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          env: testEnv,
          globalSetup: ['tests/integration/globalSetup.ts'],
          hookTimeout: 60_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
