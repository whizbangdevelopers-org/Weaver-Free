// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/services/*.ts',
    'src/stores/*.ts',
    'src/composables/*.ts',
    'src/utils/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*',
  ],
  reporters: ['clear-text', 'json', 'html'],
  htmlReporter: {
    fileName: 'reports/mutation/html/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  concurrency: 4,
  timeoutMS: 30000,
};

export default config;
