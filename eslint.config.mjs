// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'

export default [
  // Global ignores (replaces ignorePatterns)
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.quasar/',
      'src-capacitor/',
      'src-cordova/',
      'src-electron/dist/',
      'playwright-report/',
      'test-results/',
      'testing/e2e-docker/output/',
      'testing/e2e-docker/scripts/',
      'coverage-free/',
      'mcp-server/',
      'backend/',
      'tui/dist/',
      'scripts/',
    ],
  },

  // TypeScript recommended rules (before Vue so Vue config can override parser)
  ...tseslint.configs.recommended,

  // Vue essential rules (flat config format — sets vue-eslint-parser for .vue files)
  ...pluginVue.configs['flat/essential'],

  // Vue files need @typescript-eslint/parser as the nested parser for <script> blocks
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 2021,
        sourceType: 'module',
      },
    },
  },

  // Prettier (must be last to override formatting rules)
  eslintConfigPrettier,

  // Project-specific configuration
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Browser + Node
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        process: 'readonly',
        // Quasar/Cordova/PWA globals
        ga: 'readonly',
        cordova: 'readonly',
        __statics: 'readonly',
        __QUASAR_SSR__: 'readonly',
        __QUASAR_SSR_SERVER__: 'readonly',
        __QUASAR_SSR_CLIENT__: 'readonly',
        __QUASAR_SSR_PWA__: 'readonly',
        Capacitor: 'readonly',
        chrome: 'readonly',
      },
    },
    rules: {
      'prefer-promise-reject-errors': 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Allow {} type in declaration files and type params (common in Vue/Quasar generics)
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // TUI (React/Ink) — allow explicit any in hook types, suppress missing react-hooks plugin
  {
    files: ['tui/src/**/*.tsx', 'tui/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // k6 test files — k6 globals
  {
    files: ['testing/load/k6/**/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
      },
    },
  },

  // CJS config files — require() is expected
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Coverage instrumentation scripts
  {
    files: ['coverage/**/*.js'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },

  // Load test files — allow unused vars for benchmarking scaffolds
  {
    files: ['testing/load/**/*.ts', 'testing/load/**/*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
