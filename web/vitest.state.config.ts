import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    coverage: {
      ...base.test?.coverage,
      include: [
        'src/state/**/*.{ts,tsx}',
        'src/features/**/*.slice.ts',
        'src/features/**/*.selectors.ts',
        'src/features/job-api/job-api.client.ts',
        'src/features/job-search/job-search.mapping.ts',
        'src/features/theme/**/*.{ts,tsx}',
      ],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.index.ts'],
      reportsDirectory: 'coverage/state',
    },
  },
});
