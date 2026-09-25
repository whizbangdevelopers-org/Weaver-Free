// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Regression corpus — `no-interpolated-console-format` (CWE-134).
 *
 * See execfile.ts for the annotation contract. This rule is structural, not taint: the eight
 * sites CodeQL flagged on 2026-09-24 (js/tainted-format-string) carried a route-validated name
 * into a service's console.error, a flow semgrep's single-function engine cannot follow.
 */

// ---------------------------------------------------------------------------
// MUST CATCH
// ---------------------------------------------------------------------------

export function interpolatedWithError(alpha: string, err: unknown) {
  // taint-expect: no-interpolated-console-format
  console.error(`[microvm] Failed to start VM '${alpha}':`, err)
}

export function interpolatedWarnWithValue(bravo: string) {
  // taint-expect: no-interpolated-console-format
  console.warn(`${bravo} changed`, 1)
}

// ---------------------------------------------------------------------------
// MUST NOT FLAG
// ---------------------------------------------------------------------------

// The prescribed fix: constant format, escaped value as an argument.
export function constantFormat(charlie: string, err: unknown) {
  console.error('[microvm] Failed to start VM %s:', JSON.stringify(charlie), err)
}

// One argument: Node prints it verbatim and reads no directive.
export function singleArgument(delta: string) {
  console.error(`[license] Invalid LICENSE_KEY: ${delta}`)
}

// A template with nothing interpolated is a constant.
export function staticTemplate(err: unknown) {
  console.error(`[notification] adapter failed:`, err)
}

// Not console: another logger's contract is its own.
export function otherLogger(logger: { error: (...a: unknown[]) => void }, echo: string, err: unknown) {
  logger.error(`${echo} failed`, err)
}
