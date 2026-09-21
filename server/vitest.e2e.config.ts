import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    fileParallelism: false,
    retry: 0,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
