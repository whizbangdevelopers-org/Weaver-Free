<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Review panel (Stage B / WVR-197) — the Level-1 "human promotes" surface. Approve sets
  approved_by (promotion) + logs to the append-only knowledge_approval_events; Reject needs
  a reason. The per-class trust gauge (approve/reject/supersede rates) is the measurement
  carried forward to Jacquard. Canonical: plans/cross-version/AUTONOMY-GOVERNANCE-PLAN.md.
-->
<template>
  <div class="q-pa-md" style="height: 100%; overflow-y: auto;">
    <div class="row items-center q-mb-sm">
      <div class="text-subtitle2"><q-icon name="mdi-check-decagram-outline" class="q-mr-xs" />Review queue</div>
      <q-space />
      <q-input v-model="actor" dense outlined label="Reviewer (you) *" style="width: 180px" class="q-mr-sm"
               data-testid="aq-actor" :error="!actor.trim()" hide-bottom-space @blur="rememberActor" />
      <q-toggle v-model="pendingOnly" label="Pending only" @update:model-value="load" />
      <q-btn flat dense round icon="mdi-refresh" class="q-ml-sm" :loading="loading" @click="load" />
    </div>

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
                 :disable="!actor.trim()" @click="onApprove(props.row)" />
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
import { ref, onMounted } from 'vue'
import { useQuasar, type QTableColumn } from 'quasar'
import { useKnowledgeEditor, rejectReasonValid, type EntryRow } from '../composables/useKnowledgeEditor'

const $q = useQuasar()
const { entries: rows, events, gaugeRows, loading, listEntries, getEntry, getEvents, getGauge, approveEntry, rejectEntry } = useKnowledgeEditor()

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
async function onView(row: EntryRow) {
  try {
    viewEntry.value = await getEntry(row.id)
    viewOpen.value = true
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
