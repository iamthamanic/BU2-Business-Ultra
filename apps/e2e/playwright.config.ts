import { defineConfig } from '@playwright/test'

const WEB = process.env.PUBLIC_WEB_URL ?? 'http://127.0.0.1:8741'
const API = process.env.PUBLIC_API_URL ?? 'http://127.0.0.1:8742'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: WEB,
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : [
        {
          command: 'pnpm --filter @bu2/api exec tsx src/index.ts',
          url: `${API}/api/health`,
          reuseExistingServer: true,
          cwd: '../..',
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @bu2/web exec vite --port 8741 --host 127.0.0.1',
          url: WEB,
          reuseExistingServer: true,
          cwd: '../..',
          timeout: 120_000,
        },
      ],
})
