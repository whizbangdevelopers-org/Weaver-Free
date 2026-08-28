// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Toll — the pure seam.
 *
 * A **Toll** is money paid for a service licence: one commercial software licence the OPERATOR
 * owns (a Windows product key, a RHEL subscription, SQL Server), with its seat count, expiry and
 * a reference to its key material. It is **never** Weaver's own licence key — that is
 * `license.ts` / `LicenseStore` / `requireTier`, which share an English word with this and
 * nothing else. The distinct noun exists precisely so the two can never be confused in a type,
 * a route or an audit export.
 *
 * **This module is deliberately PURE.** No I/O, no store, no routes, no tier checks. Same shape
 * as the VM-clone seam, which landed as a pure guard one slice before the route that uses it:
 * the part carrying the security and correctness content is testable on its own, and stays
 * correct wherever it is eventually wired.
 *
 * Key material is reached through an adapter (see `TollSecretStore`), never a hardcoded store.
 */

/** How a licence is counted. Weaver never interprets these beyond seat arithmetic. */
export type TollModel =
  | 'per-device'
  | 'per-core'
  | 'per-socket'
  | 'per-user'
  | 'subscription'
  | 'site'

/**
 * One licence the operator owns.
 *
 * `keyRef` is a REFERENCE resolved through a `TollSecretStore`, never the key material itself.
 * Keeping the material out of this record is what lets the whole audit surface — who holds what,
 * what expires when — be queried WITHOUT decrypting anything, which is better for compliance
 * rather than a concession to it.
 */
export interface TollRecord {
  id: string
  vendor: string
  product: string
  edition?: string
  model: TollModel
  /** `null` means unlimited (a site licence). Never `0` — that is "none", a different thing. */
  seatsTotal: number | null
  expiresAt?: string | null
  /** Distinct from expiry: CIS 2.2's "currently supported" is a different date. */
  supportEndsAt?: string | null
  reference?: string
  keyRef?: string | null
  notes?: string
  /** An administrative hold takes a Toll out of allocation without deleting it. */
  held?: boolean
}

/**
 * One binding, append-only.
 *
 * **Not a mutable `inUse` flag**, and that is the single most load-bearing choice in the data
 * model. An auditor's question is *"who held this in March"*, and a boolean cannot answer it.
 * Current state is a projection of this log — `seatsUsed()` below.
 */
export interface TollAllocation {
  tollId: string
  workloadName: string
  /** Wall-clock epoch ISO — what an auditor reads. */
  allocatedAt: string
  allocatedBy: string
  releasedAt?: string | null
  reason?: string
}

/**
 * A request's arrival stamp. THREE fields, because Node cannot express this in one.
 *
 * Measured rather than assumed: `Date.now()` is millisecond-granular (17 distinct values in
 * 200,000 calls), `process.hrtime.bigint()` is monotonic and nanosecond-distinct but
 * UPTIME-relative — so it is meaningless across processes or a restart — and
 * `performance.timeOrigin + performance.now()` is epoch-anchored at roughly MICROSECOND real
 * precision, its nanosecond digits being float64 noise rather than measurement.
 *
 * So `receivedAt` is for the record and `seq` is for the order, and `allocatorId` is what makes
 * `seq` comparable at all. A single nanosecond wall-clock field would be false precision.
 */
export interface TollRequestStamp {
  /** Epoch ISO. The audit record. */
  receivedAt: string
  /** `process.hrtime.bigint()`. Monotonic, always distinct, comparable ONLY within one process. */
  seq: bigint
  /** Which resolver stamped it. Without this, `seq` cannot be compared across restarts. */
  allocatorId: string
  /** Total-orders two identical stamps, so ordering is never implementation-defined. */
  requestId: string
}

export interface TollRequest {
  product: string
  workloadName: string
  requestedBy: string
  stamp: TollRequestStamp
}

/**
 * Where key material lives — an ADAPTER, never a hardcoded store.
 *
 * Three implementations arrive in tier order: `file` (a path the operator supplies — Free, the
 * default, and the same adapter a sops-nix operator already uses, since sops-nix's whole
 * delivery mechanism IS a file at a path), `vault` (Weaver's own admin-managed credential store,
 * Solo/Team) and `kms` (external, Fabrick, later).
 *
 * **Free is why the seam exists rather than a direct vault call.** A Free install has no
 * credential vault — Free is bring-your-own-key, never stored — so a vault-only design would put
 * the metadata registry — the
 * compliance half, the part answering *what do we own* — out of reach at exactly the tier most
 * likely to be running an unlicensed guest by accident. At Free a Toll therefore carries no
 * `keyRef` at all and this interface is never called.
 */
export interface TollSecretStore {
  readonly kind: 'file' | 'vault' | 'kms'
  /** Resolve key material. Returns null when the ref does not resolve — never throws for absence. */
  resolve(keyRef: string): Promise<string | null>
}

// ---------------------------------------------------------------------------
// Projections over the allocation log
// ---------------------------------------------------------------------------

/** Live allocations for a Toll — the projection the seat count is derived from. */
export function activeAllocations(
  allocations: readonly TollAllocation[],
  tollId: string,
): TollAllocation[] {
  return allocations.filter((a) => a.tollId === tollId && !a.releasedAt)
}

/**
 * Seats consumed right now.
 *
 * A LAPSED allocation still counts. The workload is still consuming the entitlement, and
 * releasing its seat because a date passed would under-report the exact number an auditor is
 * asking for. Expiry changes what you are ENTITLED to, not what you are USING.
 */
export function seatsUsed(allocations: readonly TollAllocation[], tollId: string): number {
  return activeAllocations(allocations, tollId).length
}

/** Seats left, or `null` for an unlimited (site) licence. */
export function seatsFree(
  toll: TollRecord,
  allocations: readonly TollAllocation[],
): number | null {
  if (toll.seatsTotal === null) return null
  return Math.max(0, toll.seatsTotal - seatsUsed(allocations, toll.id))
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

export function isExpired(toll: TollRecord, now: Date): boolean {
  if (!toll.expiresAt) return false
  const t = Date.parse(toll.expiresAt)
  // An UNPARSEABLE date is not "not expired". Treating it as valid would let a typo silently
  // extend an entitlement forever, which is the direction that costs money at an audit.
  if (Number.isNaN(t)) return true
  return t <= now.getTime()
}

/**
 * Allocations whose Toll has lapsed underneath them.
 *
 * These WARN and are audited; they never stop a workload and never release a seat. Not a
 * preference — Weaver's own licence already sets the house rule (`license.ts`): expiry inside
 * the grace window keeps the tier, and beyond it the tier drops to Free *"deliberately — a
 * lapsed customer keeps real access to their own workloads"*. Generalised: **a lapse degrades
 * entitlement; it never withdraws access.**
 */
export function lapsedAllocations(
  tolls: readonly TollRecord[],
  allocations: readonly TollAllocation[],
  now: Date,
): TollAllocation[] {
  const expired = new Set(tolls.filter((t) => isExpired(t, now)).map((t) => t.id))
  return allocations.filter((a) => !a.releasedAt && expired.has(a.tollId))
}

// ---------------------------------------------------------------------------
// Eligibility and selection
// ---------------------------------------------------------------------------

/** Why this Toll cannot serve this request, or null when it can. */
export function ineligibleReason(
  toll: TollRecord,
  allocations: readonly TollAllocation[],
  req: Pick<TollRequest, 'product'>,
  now: Date,
): string | null {
  if (toll.product !== req.product) return `product mismatch (${toll.product})`
  if (toll.held) return 'administratively held'
  if (isExpired(toll, now)) return `expired ${toll.expiresAt}`
  const free = seatsFree(toll, allocations)
  if (free !== null && free <= 0) return `no seats free (${toll.seatsTotal} in use)`
  return null
}

/**
 * Pick a Toll for a request, or null when none is eligible.
 *
 * **Tie-break: soonest expiry first.** It extracts value from what you already own before it
 * lapses, and it surfaces expiry through ordinary use rather than through a report nobody opens.
 * A Toll with NO expiry sorts last — it cannot be wasted by waiting. Ties beyond that fall back
 * to `id` so the choice is deterministic and a replay of the same log yields the same result.
 */
export function selectToll(
  tolls: readonly TollRecord[],
  allocations: readonly TollAllocation[],
  req: Pick<TollRequest, 'product'>,
  now: Date,
): TollRecord | null {
  const eligible = tolls.filter((t) => ineligibleReason(t, allocations, req, now) === null)
  if (eligible.length === 0) return null
  return [...eligible].sort((a, b) => {
    const ax = a.expiresAt ? Date.parse(a.expiresAt) : Number.POSITIVE_INFINITY
    const bx = b.expiresAt ? Date.parse(b.expiresAt) : Number.POSITIVE_INFINITY
    if (ax !== bx) return ax - bx
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]!
}

/**
 * FCFS order over pending requests — first come, first served.
 *
 * Ordering and SERIALISATION are different problems and only this function is the first.
 * Timestamps say who *should* win; something else has to make exactly one of them *actually*
 * win, and that is a single resolver draining this order. With one writer, allocation is serial
 * by construction: no contention, no retry, no delay timer.
 *
 * Across hosts this is only meaningful with ONE ordering authority — NTP skew is milliseconds,
 * which swamps nanosecond ordering entirely.
 */
export function fcfsOrder(requests: readonly TollRequest[]): TollRequest[] {
  return [...requests].sort((a, b) => {
    if (a.stamp.seq !== b.stamp.seq) return a.stamp.seq < b.stamp.seq ? -1 : 1
    if (a.stamp.allocatorId !== b.stamp.allocatorId) {
      return a.stamp.allocatorId < b.stamp.allocatorId ? -1 : 1
    }
    return a.stamp.requestId < b.stamp.requestId ? -1 : a.stamp.requestId > b.stamp.requestId ? 1 : 0
  })
}

/**
 * The guard. Returns a reason to REFUSE, or null to proceed.
 *
 * **Fail closed.** No seat means refuse to provision, with the shortfall named — never provision
 * unlicensed with a warning. The question that settles it: can this condition change the answer?
 * Yes — running unlicensed software is a compliance breach, so it must refuse rather than
 * degrade.
 *
 * An unsatisfiable request also FAILS AND LEAVES rather than waiting, which is what keeps FCFS
 * free of head-of-line blocking: a request for a product with no free seats must not stall the
 * queue behind it.
 */
export function allocationRejectionReason(
  tolls: readonly TollRecord[],
  allocations: readonly TollAllocation[],
  req: Pick<TollRequest, 'product' | 'workloadName'>,
  now: Date,
): string | null {
  const forProduct = tolls.filter((t) => t.product === req.product)
  if (forProduct.length === 0) {
    return `No Toll recorded for '${req.product}'. Record the licence you own before provisioning a workload that needs it.`
  }
  if (selectToll(tolls, allocations, req, now) !== null) return null

  // Every candidate failed. Say WHY, per Toll — "no seat available" alone leaves the operator
  // unable to tell an expiry from a shortfall from a hold, which are three different purchases.
  const detail = forProduct
    .map((t) => `${t.id}: ${ineligibleReason(t, allocations, req, now)}`)
    .join('; ')
  return `No Toll available for '${req.product}' to run '${req.workloadName}' — ${detail}`
}
