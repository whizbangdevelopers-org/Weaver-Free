// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { parseLicenseKey, TIER_ORDER, type Tier } from '../license.js'
import { TIERS } from '../constants/vocabularies.js'

/**
 * Keeps the running process's licence current.
 *
 * The tier used to be resolved exactly once, at start-up, from a key file read then and never
 * again. Two things that genuinely happen were therefore invisible to a running host:
 *
 *   * **A pushed key.** A renewal mints a new key and mails it; installing it changed a file the
 *     process had already read, so the new period did not take effect until something restarted.
 *   * **The clock.** A key carries its own expiry and the tier is resolved against `now`. A
 *     licence whose expiry and grace elapsed mid-run left the tier frozen at its pre-lapse value
 *     for the life of the process — every tier gate reads that one value, so this was never a
 *     DNS-only or feature-local staleness.
 *
 * Re-reading on a timer fixes both with one mechanism, and it is the licence layer that has to
 * own it: a timer bolted onto any single consumer fixes where the staleness is *visible* and
 * leaves where it *originates*.
 */

/** Days before expiry at which the admin is warned. Tightening, because missing the last one costs the tier. */
export const EXPIRY_WARNING_DAYS = [30, 20, 10, 7, 5, 3, 2, 1] as const

/** How often the key file is re-read. */
export const DEFAULT_POLL_INTERVAL_MS = 60 * 60 * 1000

export interface LicenseSnapshot {
  tier: Tier
  expiry: Date | null
  graceMode: boolean
}

/** What a re-read produced, and whether it should be acted on. */
export type LicenseReadOutcome =
  | { kind: 'resolved'; snapshot: LicenseSnapshot }
  /** The file is definitively gone — the revoke path writes exactly this state. */
  | { kind: 'absent' }
  /** Present but unusable. Deliberately NOT a state: see `resolveLicense`. */
  | { kind: 'unreadable'; reason: string }

export const FREE_SNAPSHOT: LicenseSnapshot = { tier: TIERS.FREE, expiry: null, graceMode: false }

/**
 * Resolve a snapshot from whatever the key file currently holds.
 *
 * The three outcomes are not symmetric, and the asymmetry is the point:
 *
 *   * **Parsed** — authoritative. Tier, expiry and grace all come from the signed payload,
 *     evaluated against `now`, so an expiry that has passed since the last read shows up here.
 *   * **Absent** — also authoritative. Removing the key file IS how a licence is revoked, so
 *     ENOENT means Free and must be acted on.
 *   * **Unreadable** — authoritative about nothing. A present-but-invalid file is a transient
 *     mid-write far more often than it is a real downgrade, and a push writes the file that this
 *     poll may land inside of. Treating it as Free would drop a paying customer's tier on a race
 *     with their own renewal. The caller holds its current state and logs.
 *
 * That last branch is the one worth stating explicitly: absorbing a condition that cannot change
 * the answer, and refusing one that can.
 */
export function resolveLicense(
  read: { content: string | null; error?: string },
  hmacSecret: string,
  now: Date = new Date(),
): LicenseReadOutcome {
  if (read.error) return { kind: 'unreadable', reason: read.error }
  if (read.content === null) return { kind: 'absent' }

  const trimmed = read.content.trim()
  if (trimmed === '') return { kind: 'unreadable', reason: 'key file is empty' }

  // An empty secret cannot validate anything, so parsing would accept a forged key. Same guard
  // as start-up config resolution, and for the same reason.
  if (hmacSecret.length === 0) return { kind: 'unreadable', reason: 'no HMAC secret configured' }

  try {
    const result = parseLicenseKey(trimmed, hmacSecret, now)
    return {
      kind: 'resolved',
      snapshot: { tier: result.tier, expiry: result.expiry, graceMode: result.graceMode },
    }
  } catch (err) {
    return { kind: 'unreadable', reason: err instanceof Error ? err.message : 'unparseable key' }
  }
}

/** True when anything an operator would care about differs. */
export function snapshotChanged(a: LicenseSnapshot, b: LicenseSnapshot): boolean {
  return (
    a.tier !== b.tier ||
    a.graceMode !== b.graceMode ||
    (a.expiry?.getTime() ?? null) !== (b.expiry?.getTime() ?? null)
  )
}

/** Whole days from `now` until `expiry`, rounded up — 0.2 days left is still "today". */
export function daysUntil(expiry: Date, now: Date): number {
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000)
}

export interface WarningDecision {
  /** The threshold to announce, or null when nothing is newly due. */
  send: number | null
  /** Every threshold now considered announced — always a superset of `alreadySent`. */
  sent: number[]
}

/**
 * Decide which expiry warning to raise.
 *
 * A threshold is *crossed* once `daysRemaining` falls to or below it. In steady state exactly one
 * new threshold crosses per check, so this returns that one. After downtime several can be due at
 * once — a host offline from day 30 to day 6 crosses 30, 20, 10 and 7 together — and firing four
 * notifications at once is noise that buries the only one that matters. So the TIGHTEST unsent
 * threshold is announced and the looser ones are marked without being sent: they describe a
 * deadline that is no longer the nearest true thing to say.
 */
export function decideWarning(daysRemaining: number, alreadySent: readonly number[]): WarningDecision {
  const crossed = EXPIRY_WARNING_DAYS.filter(t => daysRemaining <= t)
  const unsent = crossed.filter(t => !alreadySent.includes(t))
  const sent = [...new Set([...alreadySent, ...crossed])].sort((a, b) => b - a)

  if (unsent.length === 0) return { send: null, sent: [...alreadySent].sort((a, b) => b - a) }
  return { send: Math.min(...unsent), sent }
}

/**
 * Warning state, persisted so a restart does not re-announce.
 *
 * Keyed by the expiry it describes: a pushed key moves the expiry, which invalidates every
 * threshold recorded against the old one. Comparing the stored expiry rather than clearing on
 * change means a rollback to a previous key also re-arms correctly.
 */
export interface WarningState {
  expiry: string | null
  sent: number[]
}

export const EMPTY_WARNING_STATE: WarningState = { expiry: null, sent: [] }

/** The thresholds already announced for THIS expiry — an empty list when the expiry moved. */
export function sentFor(state: WarningState, expiry: Date | null): number[] {
  const iso = expiry?.toISOString() ?? null
  return state.expiry === iso ? state.sent : []
}

/**
 * True when a tier licenses DNS Core (Solo and above).
 *
 * Read from a tier that is passed in, never from ambient config, so the caller cannot accidentally
 * ask about the tier it is replacing rather than the one it is applying.
 */
export function dnsPublishable(tier: Tier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[TIERS.SOLO]
}

/** The mutable licence fields of the live config object. */
export interface LicenseConfigTarget {
  tier: Tier
  licenseExpiry: Date | null
  licenseGraceMode: boolean
}

export interface TierChangeNotification {
  event: 'license:changed'
  severity: 'error' | 'success'
  message: string
  details: { from: Tier; to: Tier; graceMode: boolean }
}

export interface TierChangeAudit {
  action: 'license.tier-changed'
  success: true
  userId: null
  username: 'license-watcher'
  details: { from: Tier; to: Tier; graceMode: boolean }
}

/**
 * Everything applying a licence touches, as injectable seams.
 *
 * `dns` is the one that matters. Publishing is a state to enter and leave — a lapse has to
 * *withdraw* a zone that is already on disk, not merely stop writing one — and until this was
 * extracted there was no way to drive a process across that transition in a test. The re-read had
 * thirty unit tests and the withdrawal had its own; nothing exercised the step between them, which
 * is the only step that can leave a Free host serving a Solo zone forever.
 */
export interface ApplyLicenseDeps {
  /**
   * The live config object, mutated in place. Every route plugin holds a reference to this one
   * object and reads `tier` per request, so in-place mutation is what makes a tier change reach
   * `requireTier` without re-registering anything. Replacing the object would silently strand them.
   */
  config: LicenseConfigTarget
  log: { warn(obj: Record<string, unknown>, msg: string): void }
  audit(entry: TierChangeAudit): void
  notify(notification: TierChangeNotification): Promise<void>
  dns: { start(): void; stop(): Promise<void> }
}

/**
 * Build the function that applies a freshly-resolved licence to the running process.
 *
 * A factory rather than a free function because the effects it drives — config mutation, audit,
 * notification, DNS publishing — are the whole behaviour. A pure planner returning "what should
 * happen" would be testable and would assert nothing about whether the zone was actually
 * withdrawn, which is the one claim worth making.
 */
export function createLicenseApplier(
  deps: ApplyLicenseDeps,
): (next: LicenseSnapshot) => Promise<void> {
  return async function applyLicense(next: LicenseSnapshot): Promise<void> {
    const previous: LicenseSnapshot = {
      tier: deps.config.tier,
      expiry: deps.config.licenseExpiry,
      graceMode: deps.config.licenseGraceMode,
    }
    if (!snapshotChanged(previous, next)) return

    deps.config.tier = next.tier
    deps.config.licenseExpiry = next.expiry
    deps.config.licenseGraceMode = next.graceMode

    const direction = TIER_ORDER[next.tier] - TIER_ORDER[previous.tier]
    deps.log.warn(
      {
        from: previous.tier,
        to: next.tier,
        graceMode: next.graceMode,
        expiresAt: next.expiry?.toISOString() ?? null,
      },
      'license: tier changed while running',
    )

    deps.audit({
      action: 'license.tier-changed',
      success: true,
      userId: null,
      username: 'license-watcher',
      details: { from: previous.tier, to: next.tier, graceMode: next.graceMode },
    })

    if (previous.tier !== next.tier) {
      await deps.notify({
        event: 'license:changed',
        severity: direction < 0 ? 'error' : 'success',
        message:
          direction < 0
            ? `License downgraded to ${next.tier} — features above that tier are no longer available`
            : `License is now ${next.tier}`,
        details: { from: previous.tier, to: next.tier, graceMode: next.graceMode },
      })
    }

    // DNS follows the tier rather than the start-up tier. This is the whole of what a DNS-local
    // timer would have bought, obtained at the layer where the staleness originates.
    if (dnsPublishable(next.tier)) {
      deps.dns.start()
    } else {
      await deps.dns.stop()
    }
  }
}
