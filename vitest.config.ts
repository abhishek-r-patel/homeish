// Vitest configuration for pure unit tests.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    restoreMocks: true,
  },
});
