// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Free-safe demo-mode flag surface.
 *
 * Ships with every tier, including Weaver Free. Contains the tiny set of
 * runtime flag-reading functions and static link constants that non-demo
 * components need to check whether demo mode is active and where to send
 * demo-funnel CTAs. NO mock data, NO getDemo* accessors, NO tier-gated
 * state — those live in src/config/demo.ts and are sync-excluded from the
 * Free mirror.
 *
 * When a component needs only "is demo mode on?" — import from here.
 * When a component needs mock data (DEMO_HOSTS, getDemoVmsForTier, etc.) —
 * import from src/config/demo (the importing file must itself be excluded
 * from the Free mirror, or the import must be guarded with
 * `import.meta.env.VITE_FREE_BUILD !== 'true'`).
 */

import { TIERS } from 'src/constants/vocabularies'

/** Tier stage labels — update here as product progresses.
 *  Shown on the tier buttons in the private demo toolbar. */
export const DEMO_TIER_STAGES: Record<string, string> = {
  [TIERS.FREE]: 'Released',
  [TIERS.SOLO]: 'User Testing',
  [TIERS.FABRICK]: 'In Development',
}

/** Check whether the app is running in demo mode. */
export function isDemoMode(): boolean {
  // Build-time flag (set by CI or scripts/build-demo.sh)
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true
  if (typeof localStorage !== 'undefined') {
    // Migrate legacy container-loom-demo-mode key to weaver-demo-mode
    const legacyCl = localStorage.getItem('container-loom-demo-mode')
    if (legacyCl !== null) {
      localStorage.setItem('weaver-demo-mode', legacyCl)
      localStorage.removeItem('container-loom-demo-mode')
    }
    // Runtime flag (set by DemoLoginPage after captcha)
    if (localStorage.getItem('weaver-demo-mode') === 'true') return true
    // Legacy key (backward compat)
    if (localStorage.getItem('microvm-demo-mode') === 'true') return true
  }
  return false
}

/** Check whether this is the public (curated) demo build. */
export function isPublicDemo(): boolean {
  return import.meta.env.VITE_DEMO_PUBLIC === 'true'
}

/** Links shown in the demo banner and throughout demo-mode UI. */
export const DEMO_LINKS = {
  github: 'https://github.com/whizbangdevelopers-org/Weaver-Free',
  install: 'https://github.com/whizbangdevelopers-org/Weaver-Free#quick-start',
  docs: 'https://github.com/whizbangdevelopers-org/Weaver-Free/tree/main/docs',
  demo: 'https://weaver-dev.github.io',
} as const

/** Links for the public demo funnel — CTAs point to WBD website Divi forms (Decision #135). */
export const PUBLIC_DEMO_LINKS = {
  fmProgram: 'https://whizbangdevelopers.com/founding-member',
  contact: 'https://whizbangdevelopers.com/contact',
  getStarted: DEMO_LINKS.install,
} as const
