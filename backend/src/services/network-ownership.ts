// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Network ownership, phase A — Weaver owns the bridge and the address space; no runtime brings
 * its own network.
 *
 * Phase A **observes**. It changes what Weaver knows and says, never what it does: nothing here
 * re-attaches a workload, refuses to display one, or assigns an address. Enforcement at creation
 * is phase B (v1.2.0), which is the first version in which Weaver creates a network-attached
 * thing at all — you cannot enforce at creation before creation exists.
 *
 * WHY A MODULE FOR ONE PREDICATE. Because the comparison must happen in exactly one place. The
 * detail panel asks "is this divergent?" today; phase B's refusal path will ask the same question
 * at a completely different moment, and a second inlined `bridge !== config.bridgeInterface`
 * would let the UI and the enforcement disagree about what divergent means. The disagreement
 * would surface as a workload the UI calls conformant and the API refuses — the worst shape,
 * because both halves look individually correct.
 *
 */

/**
 * Is this workload's network the Weaver-managed one?
 *
 * THE `undefined` CASE IS THE LOAD-BEARING ONE. Unknown is **not** violating.
 *
 * Apptainer instances have no network namespace of their own by default, so `scanContainers`
 * records `bridge: undefined` rather than inventing a value — absence is the honest answer.
 * Treating absence as divergence would flag every Apptainer instance on every install as
 * violating an invariant it cannot even express, and a flag that fires on a whole runtime is one
 * operators learn to ignore. Whether "no network" is a violation or a trivial conformance is an
 * open product question (plan §5.2) that phase B must answer; until it is answered, phase A
 * declines to assert either.
 *
 * A boolean's `else` branch becomes the default for every state you never modelled
 * (`L-analysis-2026-08-07-01KZFBEXWJFQC44HBMXWVPVBX2`), so the three states are enumerated
 * explicitly rather than derived from one comparison.
 *
 * @param bridge     the network recorded on the workload; `undefined` when unknown/none
 * @param configured `services.weaver.bridgeInterface` — the Weaver-managed bridge
 */
export function isWeaverOwnedNetwork(
  bridge: string | undefined,
  configured: string,
): boolean {
  if (bridge === undefined || bridge === '') return true // unknown ≠ violating
  return bridge === configured
}

/**
 * The inverse, named for the thing the UI actually renders.
 *
 * Not sugar: call sites read `isDivergent(...)` far more often than they read
 * `!isWeaverOwnedNetwork(...)`, and a negated predicate at a call site is where an accidental
 * double-negative lands. One definition, both directions, no `!` in consumers.
 */
export function isDivergentNetwork(
  bridge: string | undefined,
  configured: string,
): boolean {
  return !isWeaverOwnedNetwork(bridge, configured)
}
