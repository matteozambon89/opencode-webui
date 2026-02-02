import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Sequential execution as requested
  workers: 1, // Single worker for sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  timeout: 120000, // 2 minutes per test for OpenCode responses
  expect: {
    timeout: 60000, // 1 minute for assertions
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
