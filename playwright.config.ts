import { defineConfig, devices } from '@playwright/test'

// End-to-end checks on a phone-sized Chrome against the production build (service worker
// included, so offline can be tested). Local only: they use data/, which isn't in the repo.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4174/',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:app && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
