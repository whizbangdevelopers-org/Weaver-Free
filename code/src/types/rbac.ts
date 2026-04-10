// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * RBAC type contracts — Workload Groups and Access Request Workflow
 * plans/v3.3.0/EXECUTION-ROADMAP.md  ·  Decisions #82–86
 *
 * These interfaces define the data shapes for v3.3 Fabrick features.
 * They are intentionally forward-looking: no implementation exists yet,
 * but every component and store that touches these concepts must build
 * toward these shapes.
 *
 * Implementation roadmap:
 *   v3.3 Phase 1  — WorkloadGroup CRUD (backend store + admin UI)
 *   v3.3 Phase 2  — ScopedWorkloadInfo + scoped Weaver view
 *   v3.3 Phase 3  — idpGroupDn mapping (requires auth-sso plugin)
 *   v3.3 Phase 4  — AccessRequest workflow (Compliance Pack add-on)
 *
 * See plans/v3.3.0/EXECUTION-ROADMAP.md for full decision log.
 */

// ---------------------------------------------------------------------------
// Workload Groups
// ---------------------------------------------------------------------------

/** A single workload assigned to a group — host-qualified to avoid name collisions */
export interface WorkloadGroupMember {
  hostId: string
  vmName: string
}

/**
 * A named set of workloads that can be assigned to users.
 *
 * Scope definition model (Decision #82):
 * - IT admin controls workload composition (members)
 * - Dept heads (owners) control group membership (which users are in the group)
 * - HR/AD controls IdP group membership when idpGroupDn is set (Decision #84)
 */
export interface WorkloadGroup {
  id: string
  name: string
  description?: string
  /** userIds — dept heads with membership management rights (not workload composition) */
  owners: string[]
  /**
   * LDAP DN or OIDC group claim to sync from when auth-sso plugin is active.
   * When set, scope is derived from IdP group membership at login.
   * Falls back to manual user.groups[] when no IdP groups match.
   * v3.3 Phase 3 — null until SSO integration ships.
   */
  idpGroupDn?: string
  members: WorkloadGroupMember[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Scoped Weaver view
// ---------------------------------------------------------------------------

import type { WorkloadInfo } from './workload'

/**
 * A workload in cross-host scope context.
 * Extends WorkloadInfo with host identity so cards can show host badges
 * and links can use the /workload/:hostId/:name route (Decision #83).
 */
export interface ScopedWorkloadInfo extends WorkloadInfo {
  hostId: string
  hostname: string
}

// ---------------------------------------------------------------------------
// Access Request Workflow (v3.3 Compliance Pack)
// ---------------------------------------------------------------------------

/**
 * State machine for access requests.
 *
 * Designed as a state machine from day one (Decision I) so v3.3 can extend
 * to escalation chains, expiry, and multi-stage approval without schema changes.
 *
 * Transitions:
 *   pending → approved  (owner approves)
 *   pending → denied    (owner denies)
 *   approved → revoked  (owner/admin revokes after grant)
 *   pending → expired   (cron fires when expiresAt is reached — v3.3 Phase 4+)
 *   approved → expired  (time-limited access expires — v3.3 Phase 4+)
 */
export type AccessRequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'revoked'
  | 'expired'

/**
 * One step in the approval chain.
 * Lightweight option 2 ships with a single step (group owner).
 * Full v3.3 extends to ApprovalStep[] for escalation chains.
 */
export interface ApprovalStep {
  /** userId of the required approver */
  approverId: string
  decision?: 'approved' | 'denied'
  comment?: string
  decidedAt?: string
}

/**
 * An access request — user asks to join a workload group.
 *
 * The steps[] array starts with one entry (the group owner) in the
 * lightweight implementation. Escalation adds entries to the array;
 * multi-stage approval adds a requiredAll flag. Neither change requires
 * a schema migration — the array is already there.
 */
export interface AccessRequest {
  id: string
  requesterId: string
  requesterUsername: string
  groupId: string
  groupName: string
  /** Approval chain — one step in option 2, multiple in full compliance workflow */
  steps: ApprovalStep[]
  status: AccessRequestStatus
  /** Populated when time-limited access is requested — null in option 2 */
  expiresAt?: string
  /** Requester's stated reason for requesting access */
  reason?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Query / summary types
// ---------------------------------------------------------------------------

/** Counts for a group's access request queue — used by the pending badge */
export interface AccessRequestQueueSummary {
  groupId: string
  pending: number
}
