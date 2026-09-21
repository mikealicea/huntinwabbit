import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    disableConsoleIntercept: true,
    include: ['e2e/job-parsing.live.ts'],
    fileParallelism: false,
    retry: 0,
    testTimeout: 65_000,
  },
});
