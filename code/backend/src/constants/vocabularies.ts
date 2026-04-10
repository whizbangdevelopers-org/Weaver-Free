// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Shared Vocabulary Constants
 *
 * Single source of truth for string literals that appear across the codebase.
 * If a value can be renamed, it must be a constant — not a string literal.
 *
 * CANONICAL FILE: src/constants/vocabularies.ts (frontend)
 * COPIES: backend/src/constants/vocabularies.ts, tui/src/constants/vocabularies.ts
 * SYNC: npm run audit:vocabulary — fails if copies diverge from canonical
 *
 * When adding a new vocabulary term:
 *   1. Add it here
 *   2. Copy the change to backend + TUI copies
 *   3. Run npm run audit:vocabulary to verify sync
 *   4. Replace all string literal usages with the constant
 */

// ── Tier Names ──────────────────────────────────────────────────────────────

export const TIERS = {
  DEMO: 'demo',
  FREE: 'free',
  WEAVER: 'weaver',
  FABRICK: 'fabrick',
} as const

export type TierName = typeof TIERS[keyof typeof TIERS]

export const TIER_ORDER: Record<TierName, number> = {
  [TIERS.DEMO]: 0,
  [TIERS.FREE]: 1,
  [TIERS.WEAVER]: 2,
  [TIERS.FABRICK]: 3,
}

export const TIER_LABELS: Record<TierName, string> = {
  [TIERS.DEMO]: 'Demo',
  [TIERS.FREE]: 'Weaver Free',
  [TIERS.WEAVER]: 'Weaver Solo',
  [TIERS.FABRICK]: 'FabricK',
}

// ── Workload Status ─────────────────────────────────────────────────────────

export const STATUSES = {
  RUNNING: 'running',
  IDLE: 'idle',
  STOPPED: 'stopped',
  FAILED: 'failed',
  UNKNOWN: 'unknown',
} as const

export type WorkloadStatus = typeof STATUSES[keyof typeof STATUSES]

// ── User Roles ──────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
  AUDITOR: 'auditor',
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.OPERATOR]: 'Operator',
  [ROLES.VIEWER]: 'Viewer',
  [ROLES.AUDITOR]: 'Auditor',
}

// ── Provisioning States ─────────────────────────────────────────────────────

export const PROVISIONING = {
  REGISTERED: 'registered',
  PROVISIONING: 'provisioning',
  PROVISIONED: 'provisioned',
  PROVISION_FAILED: 'provision-failed',
  DESTROYING: 'destroying',
} as const

export type ProvisioningState = typeof PROVISIONING[keyof typeof PROVISIONING]
