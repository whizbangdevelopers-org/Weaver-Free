// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Regression corpus — the ONE residual limit of the destructure+cast repair.
 *
 * Semgrep dedupes findings on the metavariable binding. When two handlers in the SAME
 * file bind the SAME variable name, and the plain (already-caught) form appears first,
 * the type-asserted form below it is reported only once — the second is masked until the
 * first is fixed, at which point it reappears. Iterative convergence, not a blind spot.
 *
 * This file pins that behaviour deliberately rather than leaving it as folklore:
 *
 *   - If a future semgrep stops masking, this file fails with a FALSE POSITIVE on the
 *     masked line. That is the correct failure — the limit has lifted, and the corpus
 *     comment plus the rule's own header should be updated to say so.
 *   - If the masking ever widened to hide the FIRST finding too, this file fails with a
 *     MISSED case.
 *
 * Either way the auditor tells us, which is the entire difference between a documented
 * limit and an assumption. Measured against semgrep 1.143.0.
 *
 * NOTE the contrast with every other corpus file, which uses distinct variable names
 * precisely so this effect cannot silently under-test them.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// First handler: plain destructure. Caught by the base `$REQ.params` source.
export async function plainFormFirst(request: any) {
  const { name } = request.params
  // taint-expect: no-raw-execfile-args
  await execFileAsync('/bin/vm', ['start', name])
}

// Second handler: same variable name, type-asserted. Masked by the finding above.
// Deliberately NOT annotated — see the header.
export async function castFormMasked(request: any) {
  const { name } = request.params as { name: string }
  await execFileAsync('/bin/vm', ['start', name])
}
