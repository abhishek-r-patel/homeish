// Vitest configuration for database integration tests against a disposable local PostgreSQL server.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    // Database creation is serialized (support/database.ts), so more workers only queue longer.
    maxWorkers: 4,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
