// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Stage-B (Level-1) knowledge editor + approval composable — the "human proposes ->
// human promotes" surface of the WVR-190 autonomy knob, on the knowledge domain.
// Talks to the engram-query FastAPI at /engram-query/knowledge/* (nginx strips the
// prefix). Reads are open; writes send the bearer from localStorage 'engram_write_token'
// (fleet read/write trust split). Canonical: plans/cross-version/AUTONOMY-GOVERNANCE-PLAN.md.

import { ref } from 'vue'

// WVR-191 ladder allow-lists — mirror knowledge_api.py / verify-knowledge-schema.ts.
export const TYPES = ['lesson', 'gotcha', 'pattern', 'rule'] as const
export const DOMAINS = [
  'frontend', 'backend', 'testing', 'nixos', 'security', 'process',
  'mcp', 'engram', 'devops', 'licensing', 'analysis', 'python', 'rust',
] as const
export const SCOPES = ['universal', 'language', 'language-version', 'domain', 'project', 'task'] as const
export const LAYERS = ['L1-dev', 'L2-product'] as const
export const ID_RE = /^[LG]-[a-z]+(-[a-z]+)*-\d{4}-\d{2}-\d{2}-\d{3}$/

const TOKEN_KEY = 'engram_write_token'

// ── Pure validation (WVR-191) — single source for the form + specs, no Quasar dep ──
export function entryRefRule(v: string): true | string {
  return ID_RE.test((v ?? '').trim()) || 'Must be L|G-<domain>-YYYY-MM-DD-NNN'
}
export function domainRule(v: string): true | string {
  return (DOMAINS as readonly string[]).includes(v) || 'Pick a valid domain'
}
export function bodyRule(v: string): true | string {
  return (v ?? '').trim().length > 0 || 'Body is required'
}
export function actorRule(v: string): true | string {
  return (v ?? '').trim().length > 0 || 'Author is required'
}
// The domain embedded in the id (between the prefix and the date) must match the domain
// field — the convention is L|G-{domain}-{date}-{nnn}. Returns that segment, or null.
export function entryRefDomain(entry_ref: string): string | null {
  const m = /^[LG]-(.+)-\d{4}-\d{2}-\d{2}-\d{3}$/.exec((entry_ref ?? '').trim())
  return m ? m[1] : null
}
export function domainMatchRule(entry_ref: string, domain: string): true | string {
  const d = entryRefDomain(entry_ref)
  if (d === null) return true // format already covered by entryRefRule
  return d === domain || `The id's domain (${d}) must match the Domain field (${domain})`
}
export function proposalValid(f: { entry_ref: string; domain: string; body: string; actor: string }): boolean {
  return entryRefRule(f.entry_ref) === true && domainRule(f.domain) === true &&
         domainMatchRule(f.entry_ref, f.domain) === true &&
         bodyRule(f.body) === true && actorRule(f.actor) === true
}
// A rejection must carry a reason (also enforced server-side, 422). Pure so it's testable.
export function rejectReasonValid(reason: string): boolean {
  return (reason ?? '').trim().length > 0
}

export interface EntryRow {
  id: string
  entry_ref: string
  layer: string
  scope: string
  project: string | null
  domain: string | null
  type: string
  status: string
  title: string | null
  source: string
  author: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalEvent {
  id: number
  actor: string
  action: string
  stage: string | null
  reason: string | null
  created_at: string
}

export interface GaugeRow {
  domain: string | null
  source: string
  total: number
  pending: number
  approved: number
  rejected: number
  superseded: number
  approve_rate: number | null
}

export interface EntryCreate {
  entry_ref: string
  type: string
  domain: string
  scope: string
  body: string
  actor: string
  layer?: string
  project?: string | null
  language?: string[]
  tags?: string[]
  title?: string | null
  since_version?: string | null
  related?: string[]
  graduated_to?: string | null
}

const BASE = '/engram-query/knowledge'

export function getWriteToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
}
export function setWriteToken(t: string): void {
  try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ }
}

async function readErr(res: Response): Promise<string> {
  try {
    const j = await res.json()
    return typeof j?.detail === 'string' ? j.detail : JSON.stringify(j?.detail ?? j)
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getWriteToken()}` }
}

export function useKnowledgeEditor() {
  const entries = ref<EntryRow[]>([])
  const events = ref<ApprovalEvent[]>([])
  const gaugeRows = ref<GaugeRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listEntries(params: { status?: string; domain?: string; project?: string; scope?: string; review?: boolean } = {}) {
    loading.value = true
    error.value = null
    try {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== false && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
      const res = await fetch(`${BASE}/entries${qs ? `?${qs}` : ''}`)
      if (!res.ok) throw new Error(await readErr(res))
      entries.value = (await res.json()).entries
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'list failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getEntry(id: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${BASE}/entry/${id}`)
    if (!res.ok) throw new Error(await readErr(res))
    return res.json()
  }

  async function getEvents(id: string): Promise<ApprovalEvent[]> {
    const res = await fetch(`${BASE}/entry/${id}/events`)
    if (!res.ok) throw new Error(await readErr(res))
    events.value = (await res.json()).events
    return events.value
  }

  async function getGauge(): Promise<GaugeRow[]> {
    const res = await fetch(`${BASE}/gauge`)
    if (!res.ok) throw new Error(await readErr(res))
    gaugeRows.value = (await res.json()).gauge
    return gaugeRows.value
  }

  async function createEntry(payload: EntryCreate): Promise<{ id: string; entry_ref: string; mode: string }> {
    const res = await fetch(`${BASE}/entry`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await readErr(res))
    return res.json()
  }

  async function updateEntry(id: string, patch: Record<string, unknown> & { actor: string }): Promise<void> {
    const res = await fetch(`${BASE}/entry/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(await readErr(res))
  }

  async function workflow(id: string, action: 'submit' | 'approve' | 'reject',
                          body: { actor: string; reason?: string; stage?: string }): Promise<void> {
    const res = await fetch(`${BASE}/entry/${id}/${action}`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await readErr(res))
  }

  const submitEntry  = (id: string, actor: string) => workflow(id, 'submit', { actor })
  const approveEntry = (id: string, actor: string) => workflow(id, 'approve', { actor })
  const rejectEntry  = (id: string, actor: string, reason: string) => workflow(id, 'reject', { actor, reason })

  return {
    entries, events, gaugeRows, loading, error,
    listEntries, getEntry, getEvents, getGauge,
    createEntry, updateEntry, submitEntry, approveEntry, rejectEntry,
  }
}
