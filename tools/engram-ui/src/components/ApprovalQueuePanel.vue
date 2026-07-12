<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Review panel (Stage B / WVR-197) — the Level-1 "human promotes" surface. Approve sets
  approved_by (promotion) + logs to the append-only knowledge_approval_events; Reject needs
  a reason. The per-class trust gauge (approve/reject/supersede rates) is the measurement
  carried forward to Jacquard. Canonical: plans/cross-version/AUTONOMY-GOVERNANCE-PLAN.md.
-->
<template>
  <!-- No height:100%/overflow here — the q-tab-panels .q-panel.scroll wrapper scrolls. -->
  <div class="q-pa-md">
    <div class="row items-center q-mb-sm">
      <div class="text-subtitle2"><q-icon name="mdi-check-decagram-outline" class="q-mr-xs" />Review queue</div>
      <q-space />
      <q-input v-model="actor" dense outlined label="Reviewer (you) *" style="width: 180px" class="q-mr-sm"
               data-testid="aq-actor" :error="!actor.trim()" hide-bottom-space @blur="rememberActor" />
      <q-toggle v-model="pendingOnly" label="Pending only" @update:model-value="load" />
      <q-btn flat dense round icon="mdi-refresh" class="q-ml-sm" :loading="loading" @click="load" />
    </div>

    <!-- Quarantine model (WVR-198 §5.2) -->
    <q-banner dense rounded class="bg-blue-1 text-blue-10 q-mb-sm">
      <template #avatar><q-icon name="mdi-shield-alert-outline" color="blue-8" /></template>
      Proposals here are <strong>quarantined</strong> — held out of the served store (recall &amp;
      committed markdown) until promoted. <strong>Approve</strong> promotes to served;
      <strong>Reject</strong> retires. Git-approved (llgd) entries are already served.
    </q-banner>

    <q-banner v-if="!actor.trim()" dense rounded class="bg-grey-2 text-grey-8 q-mb-sm">
      <template #avatar><q-icon name="mdi-account-alert" color="orange" /></template>
      Enter your name in <strong>Reviewer (you)</strong> to enable Approve / Reject — every
      decision is recorded against the actor in the append-only audit log.
    </q-banner>

    <q-table
      :rows="rows"
      :columns="columns"
      row-key="id"
      dense flat bordered
      :loading="loading"
      :pagination="{ rowsPerPage: 20 }"
      data-testid="aq-table"
    >
      <template #body-cell-status="props">
        <q-td :props="props">
          <q-badge :color="statusColor(props.row.status)">{{ props.row.status }}</q-badge>
          <q-badge v-if="isProposal(props.row)" color="orange" class="q-ml-xs">proposal</q-badge>
          <q-badge v-else-if="props.row.source === 'human-llgd'" color="blue-grey" class="q-ml-xs">git-approved</q-badge>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <!-- Read the body before deciding — always available -->
          <q-btn flat dense icon="mdi-eye" @click="onView(props.row)">
            <q-tooltip>View</q-tooltip>
          </q-btn>
          <!-- Approve/Reject only on actual proposals (form/ai-agent). human-llgd is
               pre-approved by git review and is not actioned here. -->
          <q-btn v-if="isProposal(props.row)"
                 flat dense color="positive" icon="mdi-check" label="Approve"
                 :disable="!actor.trim()" @click="onApprove(props.row)">
            <q-tooltip>Promote → served store (becomes recall-visible)</q-tooltip>
          </q-btn>
          <q-btn v-if="isProposal(props.row)"
                 flat dense color="negative" icon="mdi-close" label="Reject"
                 :disable="!actor.trim()" @click="onRejectClick(props.row)" />
          <q-btn flat dense icon="mdi-history" @click="loadEvents(props.row)">
            <q-tooltip>History</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Event history for the last-inspected entry -->
    <div v-if="events.length" class="q-mt-sm">
      <div class="text-caption text-grey-7">Approval events</div>
      <q-list dense bordered>
        <q-item v-for="ev in events" :key="ev.id">
          <q-item-section>
            <q-item-label>
              <q-badge :color="actionColor(ev.action)" class="q-mr-xs">{{ ev.action }}</q-badge>
              <span class="text-mono">{{ ev.actor }}</span>
              <span v-if="ev.reason" class="text-grey-7"> — {{ ev.reason }}</span>
            </q-item-label>
            <q-item-label caption>{{ ev.created_at }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- The trust gauge — carried forward to Jacquard as the auto-promote metric -->
    <div class="q-mt-md">
      <div class="text-caption text-grey-7 q-mb-xs">
        <q-icon name="mdi-gauge" /> Per-class trust gauge (approve/reject rate — the Jacquard auto-promote metric)
      </div>
      <q-markup-table dense flat bordered>
        <thead>
          <tr><th class="text-left">domain</th><th class="text-left">source</th><th>total</th>
              <th>pending</th><th>approved</th><th>rejected</th><th>approve rate</th></tr>
        </thead>
        <tbody>
          <tr v-for="(g, i) in gaugeRows" :key="i">
            <td>{{ g.domain }}</td><td>{{ g.source }}</td><td class="text-center">{{ g.total }}</td>
            <td class="text-center">{{ g.pending }}</td><td class="text-center">{{ g.approved }}</td>
            <td class="text-center">{{ g.rejected }}</td>
            <td class="text-center">{{ g.approve_rate === null ? '—' : (g.approve_rate * 100).toFixed(0) + '%' }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </div>

    <!-- View the full entry so a reviewer reads the body before deciding -->
    <q-dialog v-model="viewOpen">
      <q-card style="width: 820px; max-width: 95vw;">
        <q-bar class="bg-primary text-white">
          <q-icon name="mdi-book-open-variant" />
          <span class="q-ml-sm text-mono">{{ viewEntry?.entry_ref }}</span>
          <q-space />
          <q-btn dense flat round icon="mdi-close" v-close-popup />
        </q-bar>
        <q-card-section v-if="viewEntry" style="max-height: 78vh; overflow-y: auto;">
          <div class="row q-gutter-xs q-mb-sm">
            <q-badge outline color="primary">{{ viewEntry.type }}</q-badge>
            <q-badge outline color="primary">{{ viewEntry.domain }}</q-badge>
            <q-badge outline color="secondary">scope: {{ viewEntry.scope }}</q-badge>
            <q-badge outline>source: {{ viewEntry.source }}</q-badge>
            <q-badge :color="viewEntry.approved_by ? 'positive' : 'orange'">
              {{ viewEntry.approved_by ? 'approved by ' + viewEntry.approved_by : 'unapproved' }}
            </q-badge>
          </div>
          <div v-if="viewEntry.title" class="text-subtitle1 q-mb-xs">{{ viewEntry.title }}</div>
          <pre class="ke-body">{{ viewEntry.body }}</pre>

          <!-- Moderation consult (WVR-198 §5.2 · reuses §5.1) — advisory dup + quality,
               auto-run for proposals so the reviewer sees it before promoting. -->
          <template v-if="consultRan || consultLoading">
            <q-separator class="q-my-md" />
            <div class="text-overline text-grey-7">
              <q-icon name="mdi-robot-outline" size="14px" /> Moderation consult
              <q-spinner v-if="consultLoading" size="14px" color="primary" class="q-ml-xs" />
            </div>

            <div class="text-caption text-weight-medium q-mt-xs">Similar served entries</div>
            <q-banner v-if="consultError" dense class="bg-orange-1 text-orange-9 q-my-xs">
              Duplicate check unavailable: {{ consultError }}
            </q-banner>
            <div v-else-if="!consultLoading && dups.length === 0" class="text-caption text-positive">
              <q-icon name="mdi-check" /> No close matches in the served store.
            </div>
            <div v-for="d in dups" :key="d.entry_id" class="row items-start q-py-xxs no-wrap">
              <q-badge :color="d.supersedeCandidate ? 'deep-orange' : 'blue-grey'" class="q-mr-sm q-mt-xxs">
                {{ (d.score * 100).toFixed(0) }}%
              </q-badge>
              <div class="col text-caption">
                <span class="text-weight-medium text-mono">{{ d.entry_id }}</span>
                <span class="text-grey-5"> · {{ d.project }}</span>
                <span v-if="d.supersedeCandidate" class="text-deep-orange text-weight-bold"> · likely duplicate — supersede?</span>
              </div>
            </div>

            <div class="text-caption text-weight-medium q-mt-sm">Quality</div>
            <div v-for="(q, i) in quality" :key="i" class="row items-start q-py-xxs no-wrap text-caption">
              <q-icon :name="SEV_ICON[q.severity]" :color="SEV_COLOR[q.severity]" size="15px" class="q-mr-xs q-mt-xxs" />
              <div class="col">{{ q.message }}</div>
            </div>
          </template>
        </q-card-section>
        <q-card-actions align="right" v-if="viewEntry && isProposal(viewEntry as unknown as EntryRow)">
          <q-btn flat color="negative" icon="mdi-close" label="Reject"
                 :disable="!actor.trim()" @click="onRejectClick(viewEntry as unknown as EntryRow); viewOpen = false" />
          <q-btn color="positive" icon="mdi-check" label="Approve"
                 :disable="!actor.trim()" @click="onApprove(viewEntry as unknown as EntryRow); viewOpen = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useQuasar, type QTableColumn } from 'quasar'
import { useKnowledgeEditor, rejectReasonValid, type EntryRow } from '../composables/useKnowledgeEditor'
import { useConsult, type ConsultSeverity } from '../composables/useConsult'

const $q = useQuasar()
const { entries: rows, events, gaugeRows, loading, listEntries, getEntry, getEvents, getGauge, approveEntry, rejectEntry } = useKnowledgeEditor()

// AI-moderation (WVR-198 §5.2) — reuse the §5.1 consult so a reviewer sees the dup/quality
// feedback before promoting a quarantined proposal into the served store.
const { dups, quality, loading: consultLoading, error: consultError, ran: consultRan, runConsult, reset: resetConsult } = useConsult()
const SEV_ICON: Record<ConsultSeverity, string> = { warn: 'mdi-alert', suggest: 'mdi-lightbulb-outline', ok: 'mdi-check-circle' }
const SEV_COLOR: Record<ConsultSeverity, string> = { warn: 'deep-orange', suggest: 'blue-7', ok: 'positive' }

const ACTOR_KEY = 'engram_actor'
const actor = ref<string>((() => { try { return localStorage.getItem(ACTOR_KEY) ?? '' } catch { return '' } })())
const pendingOnly = ref(true)

// Persist the reviewer name so it's remembered and shared with the Author tab.
function rememberActor() { try { localStorage.setItem(ACTOR_KEY, actor.value) } catch { /* ignore */ } }

// A row is an actionable proposal only if a proposing mechanism authored it and it is
// not yet promoted. human-llgd is pre-approved by git review — never actioned here.
function isProposal(row: EntryRow): boolean {
  return !row.approved_by && row.status === 'active' && (row.source === 'form' || row.source === 'ai-agent')
}

const viewEntry = ref<Record<string, unknown> | null>(null)
const viewOpen = ref(false)

// Drop stale moderation feedback when the view dialog closes.
watch(viewOpen, (open) => { if (!open) resetConsult() })

async function onView(row: EntryRow) {
  resetConsult()
  try {
    viewEntry.value = await getEntry(row.id)
    viewOpen.value = true
    // Auto-run the moderation consult for actionable proposals so the reviewer sees
    // dup/quality feedback alongside the body before deciding whether to promote.
    if (isProposal(viewEntry.value as unknown as EntryRow)) {
      const e = viewEntry.value
      void runConsult({
        type: String(e.type ?? ''), scope: String(e.scope ?? ''), domain: String(e.domain ?? ''),
        entry_ref: String(e.entry_ref ?? ''), title: String(e.title ?? ''),
        body: String(e.body ?? ''), tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
      })
    }
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Load failed', timeout: 3000 })
  }
}

const columns: QTableColumn[] = [
  { name: 'entry_ref', label: 'Entry', field: 'entry_ref', align: 'left', sortable: true },
  { name: 'domain', label: 'Domain', field: 'domain', align: 'left', sortable: true },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'author', label: 'Author', field: 'author', align: 'left' },
  { name: 'approved_by', label: 'Approved by', field: 'approved_by', align: 'left' },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
]

function statusColor(s: string): string {
  return s === 'active' ? 'green' : s === 'retired' ? 'red' : 'grey'
}
function actionColor(a: string): string {
  return a === 'approve' ? 'positive' : a === 'reject' ? 'negative' : 'grey'
}

async function load() {
  try {
    // review=true → only form/ai-agent proposals awaiting promotion (human-llgd is
    // pre-approved by git review, so it never appears here).
    await listEntries(pendingOnly.value ? { review: true } : {})
    await getGauge()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Load failed', timeout: 3000 })
  }
}

async function onApprove(row: EntryRow) {
  try {
    await approveEntry(row.id, actor.value.trim())
    $q.notify({ type: 'positive', message: `Approved ${row.entry_ref}`, timeout: 2000 })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Approve failed', timeout: 3000 })
  }
}

// Core reject — guards the empty reason client-side (the API also 422s). Kept as a
// top-level fn so it is unit-testable without the interactive prompt.
async function doReject(id: string, reason: string, entryRef: string) {
  if (!rejectReasonValid(reason)) {
    $q.notify({ type: 'warning', message: 'A rejection reason is required', timeout: 2500 })
    return
  }
  try {
    await rejectEntry(id, actor.value.trim(), reason.trim())
    $q.notify({ type: 'info', message: `Rejected ${entryRef}`, timeout: 2000 })
    await load()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Reject failed', timeout: 3000 })
  }
}

function onRejectClick(row: EntryRow) {
  $q.dialog({
    title: `Reject ${row.entry_ref}`,
    message: 'Reason (recorded in the append-only audit log):',
    prompt: { model: '', type: 'text' },
    cancel: true,
  }).onOk((reason: string) => { void doReject(row.id, reason, row.entry_ref) })
}

async function loadEvents(row: EntryRow) {
  try { await getEvents(row.id) }
  catch (e) { $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'History failed', timeout: 3000 }) }
}

defineExpose({ doReject, onApprove, load })
onMounted(load)
</script>

<style scoped>
.ke-body {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
