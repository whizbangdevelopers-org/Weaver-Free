// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Playwright E2E Configuration — Engram-UI
 *
 * Engram-ui runs on its own dev server (port 9021 in E2E) and proxies
 * Weaver backend routes via /weaver (port 3121 in E2E).
 * Cognee service (port 8765) is NOT started — specs handle that gracefully.
 *
 * Run standalone:  npm run e2e:engram
 * Run single file: TEST_FILE=testing/e2e-engram/smoke.spec.ts npm run e2e:engram:single
 */
import { defineConfig, devices } from '@playwright/test'

const OUTPUT_DIR = process.env.PLAYWRIGHT_OUTPUT_DIR || 'testing/e2e-engram-docker/output'

export default defineConfig({
  testDir: './testing/e2e-engram',

  globalSetup: process.env.SKIP_GLOBAL_SETUP
    ? undefined
    : './testing/e2e-engram/global-setup.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: `${OUTPUT_DIR}/reports` }],
    ['json', { outputFile: `${OUTPUT_DIR}/test-results.json` }],
    ['list'],
  ],

  outputDir: `${OUTPUT_DIR}/test-results`,
  timeout: 120000,

  use: {
    baseURL: process.env.ENGRAM_DEV_PORT
      ? `http://localhost:${process.env.ENGRAM_DEV_PORT}`
      : 'http://localhost:9021',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
          : {}),
      },
    },

    ...(process.env.FULL_BROWSER_TEST
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],

  webServer: process.env.SKIP_GLOBAL_SETUP
    ? undefined
    : {
        command: 'npx quasar dev',
        url: process.env.ENGRAM_DEV_PORT
          ? `http://localhost:${process.env.ENGRAM_DEV_PORT}`
          : 'http://localhost:9021',
        reuseExistingServer: true,
        timeout: 120000,
      },
})
