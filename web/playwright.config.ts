import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/auth-provider.mjs',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        APP_STAGE: 'dev',
        API_BASE_URL_DEV: 'http://127.0.0.1:3101',
        SUPABASE_URL: 'http://127.0.0.1:3101',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional',
        APP_ORIGIN: 'http://127.0.0.1:3100',
      },
    },
  ],
});
