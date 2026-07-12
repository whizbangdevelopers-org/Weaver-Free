// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// AI-consult on Author (WVR-198 §5.1) — the *consult seam* of the autopromote_policy,
// exercised at Level-1 where the stakes are low. ADVISORY only (non-blocking): it surfaces
// feedback, the human still decides and can submit anyway. Two tiers:
//   1. Duplicate / overlap — semantic recall of the draft over the served pgvector store
//      (/engram-query/search, zero new infra): "84% similar to G-… — supersede instead of add?"
//   2. Quality / schema — deterministic lint of the captured authoring rules (required prose
//      blocks, id-domain match, universal-neutral). No LLM: these checks are decidable, so
//      they run instantly and are unit-testable. The LLM metadata-suggestion tier
//      (domain/scope/type/tags from the body, on foundry inference) is a later step.
//
// Canonical: plans/cross-version/ENGRAM-UI-PLAN.md §5.1.

import { ref } from 'vue'
import { entryRefDomain } from './useKnowledgeEditor'

export type ConsultSeverity = 'warn' | 'suggest' | 'ok'

export interface QualityFinding {
  severity: ConsultSeverity
  message: string
}

export interface DupMatch {
  entry_id: string
  project: string
  score: number
  snippet: string
  supersedeCandidate: boolean
}

export interface ConsultDraft {
  type: string
  scope: string
  domain: string
  entry_ref: string
  title: string
  body: string
  tags: string[]
}

// A recall score at/above this is strong enough to suggest superseding rather than adding.
export const SUPERSEDE_THRESHOLD = 0.82

// Required prose blocks per type — mirrors the llgd body format (**Root cause:** / **Rule:**
// / **Why this shape wins:** for lessons; **Problem:** / **Fix:** / **Rule:** for gotchas).
// Anchored on the LABEL followed by a colon, not the bare word — otherwise a body that merely
// mentions "why the rule failed, how to fix it" would falsely pass as fully structured.
const REQUIRED_BLOCKS: Record<string, Array<{ label: string; re: RegExp }>> = {
  lesson: [
    { label: 'Root cause', re: /root cause\s*:/i },
    { label: 'Rule', re: /\brule\s*:/i },
    { label: 'Why this shape wins', re: /\bwhy\b[^\n:]{0,32}:/i },
  ],
  gotcha: [
    { label: 'Problem', re: /\bproblem\s*:/i },
    { label: 'Fix', re: /\bfix\s*:/i },
    { label: 'Rule', re: /\brule\s*:/i },
  ],
}

// Project-specific tokens that must not appear in a scope:universal entry (it should transfer
// to any project/stack). Heuristic — a warn, not a hard gate.
const PROJECT_TOKENS = /\b(weaver|fabrick|jacquard|anvil|qepton|gantry|wbd|engram-nix)\b/i

// ── Pure quality lint — no network, no LLM, fully unit-testable ────────────────
export function consultQuality(d: ConsultDraft): QualityFinding[] {
  const findings: QualityFinding[] = []
  const body = (d.body ?? '').trim()

  // 1. Required prose blocks for the chosen type
  const required = REQUIRED_BLOCKS[d.type]
  if (required) {
    const missing = required.filter((b) => !b.re.test(body)).map((b) => b.label)
    if (missing.length) {
      findings.push({
        severity: 'suggest',
        message: `A ${d.type} usually documents ${required.map((b) => b.label).join(' / ')} — missing: ${missing.join(', ')}.`,
      })
    }
  }

  // 2. id-domain must match the Domain field
  const idDomain = entryRefDomain(d.entry_ref)
  if (idDomain !== null && idDomain !== d.domain) {
    findings.push({
      severity: 'warn',
      message: `The id's domain (${idDomain}) does not match the Domain field (${d.domain}).`,
    })
  }

  // 3. universal-neutral: a scope:universal entry should not name a specific project
  if (d.scope === 'universal') {
    const m = PROJECT_TOKENS.exec(body)
    if (m) {
      findings.push({
        severity: 'warn',
        message: `scope=universal but the body names a specific project ("${m[0]}"). Neutralize the wording or narrow the scope.`,
      })
    }
  }

  // 4. lightweight metadata nudges
  if (!(d.title ?? '').trim()) {
    findings.push({ severity: 'suggest', message: 'No title — a one-line title makes the entry scannable in Browse/Search.' })
  }
  if (!d.tags || d.tags.length === 0) {
    findings.push({ severity: 'suggest', message: 'No tags — add 2–5 keywords so related entries surface together.' })
  }

  if (findings.length === 0) {
    findings.push({ severity: 'ok', message: 'No quality issues found. The draft matches the authoring conventions.' })
  }
  return findings
}

// Build the semantic-recall query from the draft — title carries the strongest signal,
// the body adds context. Bounded so the GET query stays sane.
function dupQuery(d: ConsultDraft): string {
  return `${d.title ?? ''} ${d.body ?? ''}`.trim().slice(0, 500)
}

export function useConsult() {
  const dups = ref<DupMatch[]>([])
  const quality = ref<QualityFinding[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ran = ref(false)

  // Real semantic dup-check over the served pgvector store — reuses /engram-query/search.
  async function findDuplicates(d: ConsultDraft): Promise<DupMatch[]> {
    const q = dupQuery(d)
    if (!q) return []
    const res = await fetch(`/engram-query/search?q=${encodeURIComponent(q)}&limit=5`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      results?: Array<{ project: string; entry_id: string; content: string; score: number }>
    }
    return (data.results ?? [])
      // never flag the draft against itself when re-authoring an existing id
      .filter((r) => r.entry_id !== d.entry_ref.trim())
      .map((r) => ({
        entry_id: r.entry_id,
        project: r.project,
        score: r.score,
        snippet: r.content.slice(0, 200),
        supersedeCandidate: r.score >= SUPERSEDE_THRESHOLD,
      }))
  }

  // Run the full advisory consult — quality is instant/local, dups hit the network.
  async function runConsult(d: ConsultDraft): Promise<void> {
    loading.value = true
    error.value = null
    quality.value = consultQuality(d)
    try {
      dups.value = await findDuplicates(d)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Duplicate check failed'
      dups.value = []
    } finally {
      ran.value = true
      loading.value = false
    }
  }

  function reset(): void {
    dups.value = []
    quality.value = []
    error.value = null
    ran.value = false
  }

  return { dups, quality, loading, error, ran, runConsult, reset }
}
