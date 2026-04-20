// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Free-Tier Coverage Config
 *
 * Variant of vitest.config.ts that excludes paid-tier and sync-excluded
 * source paths from the coverage calculation, so the reported percentage
 * reflects only the code that actually ships to Weaver-Free.
 *
 * The full Dev-repo coverage (via `vitest.config.ts`) is a different
 * metric — it measures all tiers' code. For a buyer-facing signal on
 * what Weaver-Free actually includes, use this config instead.
 *
 * Source of truth for excluded paths: `.github/sync-exclude.yml`. When
 * that file adds or removes entries under `src/`, update this file too.
 * An auditor will be added (v1.2) to enforce parity between the two.
 *
 * Usage:
 *   npm run test:coverage:free
 */
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['testing/unit/**/*.spec.ts'],
    exclude: ['testing/e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage-free',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: [
        // Baseline excludes (mirror vitest.config.ts)
        'src/**/*.d.ts',
        'src/types/**/*',
        'src/boot/**/*',
        // Sync-excluded paths — DO NOT ship to Weaver-Free.
        // Keep aligned with .github/sync-exclude.yml → src/* entries.
        'src/config/demo-data.ts',
        'src/config/delivery-versions.ts',
        'src/composables/useMilestoneModal-data.ts',
        'src/composables/useDemoContainerState-data.ts',
        'src/services/mock-vm-data.ts',
        'src/services/mock-container-data.ts',
        'src/components/weaver/**',
        'src/components/fabrick/**',
        'src/pages/weaver/**',
        'src/pages/fabrick/**',
      ],
      thresholds: {
        // Free-tier thresholds will climb with the ratchet plan documented
        // in memory:project_test_coverage_plan.md. Start where we are today;
        // raise per release. The global vitest.config.ts keeps the combined
        // (Dev-repo-wide) number — this file tracks the narrower Free scope.
        lines: 10,
        functions: 8,
        branches: 8,
        statements: 10,
      },
    },
    deps: {
      inline: ['quasar'],
    },
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
      app: resolve(__dirname, './'),
      components: resolve(__dirname, './src/components'),
      layouts: resolve(__dirname, './src/layouts'),
      pages: resolve(__dirname, './src/pages'),
      stores: resolve(__dirname, './src/stores'),
      services: resolve(__dirname, './src/services'),
    },
  },
})
