// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Type declarations for quasar.aliases.js.
//
// The module itself is plain ESM JavaScript on purpose: quasar.config.js imports it at BUILD time,
// before any TypeScript tooling is in play, and rolldown resolves it with an explicit extension.
// scripts/verify-vite-aliases.ts also imports it, and that file IS type-checked (typecheck:scripts),
// so without this declaration tsc reports the import as implicitly `any` — which is how the
// pre-push gate caught it. A .d.ts is the honest fix: it states the contract rather than
// suppressing the diagnostic.

/** Remove `//` line comments and block comments from JSONC, preserving string contents. */
export function stripJsonComments(source: string): string

/** Remove trailing commas before `}` or `]`, which tsconfig tolerates and JSON does not. */
export function stripTrailingCommas(source: string): string

/** Parse JSONC (JSON with comments and trailing commas), as tsconfig.json is allowed to be. */
export function parseJsonc(source: string, label?: string): unknown

/** Derive a Vite alias map from a tsconfig's `compilerOptions.paths`. Throws rather than degrading. */
export function deriveViteAliases(
  appDir: string,
  options?: {
    tsconfigFile?: string
    read?: (path: string, encoding: string) => string
  },
): Record<string, string>
