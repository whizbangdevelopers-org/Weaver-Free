// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Type declarations for quasar.scan.js, which is plain ESM JavaScript for the reason
// quasar.aliases.d.ts gives: quasar.config.js imports it at build time, before any TypeScript
// tooling is in play. testing/unit/quasar-scan.spec.ts imports it.

interface ViteConfLike {
  mode?: string
  server?: { warmup?: { clientFiles?: unknown } }
  optimizeDeps?: { entries?: string | string[]; include?: string[] }
  resolve?: { alias?: unknown }
  cacheDir?: string
}

/** The files the dev server warms up: Quasar's generated client entry. */
export function devClientEntries(viteConf: ViteConfLike): string[]

/** Every package a `#`-prefixed alias names, from the alias map Quasar hands Vite. */
export function packagesBehindHashAliases(
  alias: Record<string, string> | { find: unknown; replacement: unknown }[] | undefined | null
): string[]

/** Point the dev server's dependency optimizer at what the browser loads, from `extendViteConf`. */
export function configureDepOptimizer<T extends ViteConfLike>(
  viteConf: T,
  options?: { env?: Record<string, string | undefined> }
): T & { optimizeDeps: { entries?: string[]; include: string[] } }
