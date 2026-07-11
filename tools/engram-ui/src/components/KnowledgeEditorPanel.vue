<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Author panel (Stage B / WVR-197) — create a knowledge entry as a PROPOSAL
  (source='form', approved_by=null). Per-field :rules + canSubmit gate, matching the
  engram-ui house pattern (no <q-form>). A created entry lands in the Review tab.
-->
<template>
  <div class="q-pa-md" style="height: 100%; overflow-y: auto;">
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
      <q-space />
      <span v-if="!getWriteToken()" class="text-caption text-negative">
        <q-icon name="mdi-key-alert" /> Set a write token in Settings first
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import {
  useKnowledgeEditor, getWriteToken,
  TYPES, DOMAINS, SCOPES, LAYERS,
  entryRefRule, domainRule, domainMatchRule, bodyRule, actorRule, proposalValid,
} from '../composables/useKnowledgeEditor'

const emit = defineEmits<{ created: [] }>()
const $q = useQuasar()
const { createEntry } = useKnowledgeEditor()

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
    emit('created')
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Create failed', timeout: 4000 })
  } finally {
    busy.value = false
  }
}
</script>
