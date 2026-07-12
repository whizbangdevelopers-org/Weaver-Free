<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Author panel (Stage B / WVR-197) — create a knowledge entry as a PROPOSAL
  (source='form', approved_by=null). Per-field :rules + canSubmit gate, matching the
  engram-ui house pattern (no <q-form>). A created entry lands in the Review tab.
-->
<template>
  <!-- No height:100%/overflow here — the q-tab-panels .q-panel.scroll wrapper scrolls. -->
  <div class="q-pa-md">
    <div class="text-subtitle2 q-mb-sm">
      <q-icon name="mdi-text-box-plus-outline" class="q-mr-xs" />Author a knowledge proposal
    </div>
    <div class="text-caption text-grey-7 q-mb-md">
      Writes a <code>structured_entries</code> row with <code>source=form</code>. It enters as a
      proposal (<code>approved_by</code> null) and appears in <strong>Review</strong> for promotion.
    </div>

    <div class="row q-col-gutter-sm">
      <q-input v-model="actor" class="col-12 col-sm-6" dense outlined label="Author (you) *"
               :rules="[actorRule]" data-testid="ke-actor" />
      <q-input v-model="entryRef" class="col-12 col-sm-6" dense outlined
               label="Entry ID * (L|G-domain-YYYY-MM-DD-NNN)"
               :rules="[entryRefRule, (v) => domainMatchRule(v, domain)]" data-testid="ke-entryref" />
      <q-select v-model="type" class="col-6 col-sm-3" dense outlined label="Type *" :options="TYPES" />
      <q-select v-model="domain" class="col-6 col-sm-3" dense outlined label="Domain *"
                :options="DOMAINS" :rules="[domainRule]" />
      <q-select v-model="scope" class="col-6 col-sm-3" dense outlined label="Scope *" :options="SCOPES" />
      <q-select v-model="layer" class="col-6 col-sm-3" dense outlined label="Layer *" :options="LAYERS" />
      <q-input v-model="title" class="col-12" dense outlined label="Title" />
      <q-input v-model="body" class="col-12" dense outlined type="textarea" autogrow
               label="Body * (markdown)" :rules="[bodyRule]" data-testid="ke-body" />
      <q-select v-model="tags" class="col-12 col-sm-6" dense outlined label="Tags" use-input use-chips
                multiple hide-dropdown-icon new-value-mode="add-unique" />
      <q-select v-model="language" class="col-12 col-sm-6" dense outlined label="Language" use-input use-chips
                multiple hide-dropdown-icon new-value-mode="add-unique" />
      <q-input v-model="project" class="col-12 col-sm-6" dense outlined label="Project (optional)" />
      <q-input v-model="sinceVersion" class="col-12 col-sm-6" dense outlined label="Since version (optional)" />
    </div>

    <div class="row items-center q-mt-md">
      <q-btn color="primary" icon="mdi-send" label="Submit proposal"
             :disable="!canSubmit || busy" :loading="busy" data-testid="ke-submit" @click="onSubmit" />
      <q-btn flat color="primary" icon="mdi-robot-outline" label="Consult" class="q-ml-sm"
             :loading="consultLoading" :disable="!body.trim()" data-testid="ke-consult" @click="onConsult" />
      <q-space />
      <span v-if="!getWriteToken()" class="text-caption text-negative">
        <q-icon name="mdi-key-alert" /> Set a write token in Settings first
      </span>
    </div>

    <!-- AI consult (WVR-198 §5.1) — advisory, non-blocking: feedback only, submit anyway. -->
    <q-card v-if="consultRan" flat bordered class="q-mt-md" data-testid="ke-consult-result">
      <q-card-section class="q-pb-none">
        <div class="text-caption text-grey-7">
          <q-icon name="mdi-robot-outline" size="14px" class="q-mr-xxs" />
          Advisory consult — feedback only. You decide; you can submit anyway.
        </div>
      </q-card-section>

      <!-- Similar entries — semantic recall over the served store -->
      <q-card-section class="q-pb-sm">
        <div class="text-overline text-grey-7">Similar entries</div>
        <q-banner v-if="consultError" dense class="bg-orange-1 text-orange-9 q-my-xs">
          <template #avatar><q-icon name="mdi-alert-circle-outline" color="orange-9" /></template>
          Duplicate check unavailable: {{ consultError }}
        </q-banner>
        <div v-else-if="dups.length === 0" class="text-caption text-positive">
          <q-icon name="mdi-check" /> No close matches — safe to add as a new entry.
        </div>
        <div v-for="d in dups" :key="d.entry_id" class="row items-start q-py-xs no-wrap">
          <q-badge :color="d.supersedeCandidate ? 'deep-orange' : 'blue-grey'" class="q-mr-sm q-mt-xxs">
            {{ (d.score * 100).toFixed(0) }}%
          </q-badge>
          <div class="col">
            <div class="text-caption text-weight-medium">
              {{ d.entry_id }} <span class="text-grey-5">· {{ d.project }}</span>
              <span v-if="d.supersedeCandidate" class="text-deep-orange text-weight-bold"> · supersede instead of add?</span>
            </div>
            <div class="text-caption text-grey-7 consult-snippet">{{ d.snippet }}</div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <!-- Quality checks — deterministic lint of the authoring conventions -->
      <q-card-section class="q-pt-sm">
        <div class="text-overline text-grey-7">Quality checks</div>
        <div v-for="(q, i) in quality" :key="i" class="row items-start q-py-xs no-wrap text-caption">
          <q-icon :name="SEV_ICON[q.severity]" :color="SEV_COLOR[q.severity]" size="16px" class="q-mr-xs q-mt-xxs" />
          <div class="col">{{ q.message }}</div>
        </div>
        <div class="text-caption text-grey-5 q-mt-xs">
          <q-icon name="mdi-flask-outline" size="13px" /> LLM metadata suggestions (domain/scope/tags from the body) arrive with foundry inference.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import {
  useKnowledgeEditor, getWriteToken,
  TYPES, DOMAINS, SCOPES, LAYERS,
  entryRefRule, domainRule, domainMatchRule, bodyRule, actorRule, proposalValid,
} from '../composables/useKnowledgeEditor'
import { useConsult, type ConsultSeverity } from '../composables/useConsult'

const emit = defineEmits<{ created: [] }>()
const $q = useQuasar()
const { createEntry } = useKnowledgeEditor()

// AI-consult (WVR-198 §5.1) — advisory, non-blocking.
const { dups, quality, loading: consultLoading, error: consultError, ran: consultRan, runConsult, reset: resetConsult } = useConsult()

function onConsult() {
  void runConsult({
    type: type.value, scope: scope.value, domain: domain.value,
    entry_ref: entryRef.value, title: title.value, body: body.value, tags: tags.value,
  })
}

const SEV_ICON: Record<ConsultSeverity, string> = { warn: 'mdi-alert', suggest: 'mdi-lightbulb-outline', ok: 'mdi-check-circle' }
const SEV_COLOR: Record<ConsultSeverity, string> = { warn: 'deep-orange', suggest: 'blue-7', ok: 'positive' }

const ACTOR_KEY = 'engram_actor'
const actor = ref<string>((() => { try { return localStorage.getItem(ACTOR_KEY) ?? '' } catch { return '' } })())
const entryRef = ref('')
const type = ref<string>('lesson')
const domain = ref<string>('process')
const scope = ref<string>('project')
const layer = ref<string>('L1-dev')
const title = ref('')
const body = ref('')
const tags = ref<string[]>([])
const language = ref<string[]>([])
const project = ref('')
const sinceVersion = ref('')
const busy = ref(false)

// A consult reflects the draft at consult-time — invalidate it once the author edits any
// consult-relevant field, so stale advice never lingers next to changed content. (Declared
// after the watched refs to avoid a TDZ on the immediate array eval.)
watch([body, title, type, domain, scope, entryRef], () => { if (consultRan.value) resetConsult() })

const canSubmit = computed(() => proposalValid({
  entry_ref: entryRef.value, domain: domain.value, body: body.value, actor: actor.value,
}))

async function onSubmit() {
  if (!canSubmit.value) return
  busy.value = true
  try {
    try { localStorage.setItem(ACTOR_KEY, actor.value) } catch { /* ignore */ }
    const res = await createEntry({
      entry_ref: entryRef.value.trim(),
      type: type.value, domain: domain.value, scope: scope.value, layer: layer.value,
      body: body.value, actor: actor.value.trim(),
      title: title.value || null,
      tags: tags.value, language: language.value,
      project: project.value || null,
      since_version: sinceVersion.value || null,
    })
    $q.notify({ type: 'positive', message: `Proposal ${res.entry_ref} created (${res.mode})`, timeout: 2500 })
    // reset (keep actor)
    entryRef.value = ''; title.value = ''; body.value = ''
    tags.value = []; language.value = []; project.value = ''; sinceVersion.value = ''
    resetConsult()
    emit('created')
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Create failed', timeout: 4000 })
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.consult-snippet {
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.85;
}
</style>
