// Vitest configuration for database integration tests against a disposable local PostgreSQL server.
import { defineConfig } from 'vitest/config';
import { IntegrationProgressReporter } from './tests/integration/support/progress-reporter';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    reporters: ['default', new IntegrationProgressReporter()],
    // Database creation is serialized (support/database.ts), so more workers only queue longer.
    maxWorkers: 4,
    // Limits only catch hangs. The heaviest tests take ~17 s on an idle machine
    // and several times longer when a build or browser tests share the CPU.
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
});
