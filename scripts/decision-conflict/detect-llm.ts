// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * detect-llm — Layer 3: LLM judge (gated, fail-closed).
 *
 * LAYER 3: implementation deferred — flag-gated, fail-closed.
 *
 * For ambiguous prose claims that survive layers 1 and 2, an LLM judge would
 * decide whether the claim contradicts a resolved decision. This PR ships the
 * SCAFFOLD only: the layer is a no-op unless `layers.llm_judge` is true in the
 * config, and even when enabled it is fail-closed — it never produces a
 * conflict from a low-confidence/UNCLEAR judgement, so it can never gate CI on
 * a guess.
 *
 * When implemented (follow-up PR, only if layers 1+2 prove insufficient):
 *   - use the project's existing Anthropic API integration pattern
 *     (backend/src/services/llm-provider.ts); see the Anthropic SDK skill for
 *     model IDs / params before wiring a real call
 *   - prompt: present claim + resolved decision; ask YES/NO/UNCLEAR with
 *     confidence 0-100 and a one-sentence rationale
 *   - require confidence ≥ 80 to flag; UNCLEAR or < 80 → log to
 *     reports/decision-conflict-judge-uncertain.json for human review, do not flag
 *   - cache by (claim_hash, decision_state_hash) to avoid re-judging
 */

import type { Conflict } from './report.ts'

export interface LlmJudgeOptions {
  /** Master toggle from config.layers.llm_judge. */
  enabled: boolean
  /** Prose claims that layers 1+2 could not resolve. */
  ambiguousClaims: AmbiguousClaim[]
}

export interface AmbiguousClaim {
  file: string
  line: number
  text: string
}

/**
 * Judge ambiguous claims. Currently a fail-closed no-op:
 *   - flag off  → returns [] (never runs)
 *   - flag on   → returns [] (scaffold; a real judgement is not yet wired,
 *                 and fail-closed means "no confident YES" ⇒ no conflict)
 */
export function detectLlm(opts: LlmJudgeOptions): Conflict[] {
  if (!opts.enabled) return []
  // LAYER 3: implementation deferred. Until a real judge is wired, the
  // fail-closed contract means we emit zero conflicts (no confident YES is
  // ever produced). Ambiguous claims would be logged for human review here.
  return []
}
