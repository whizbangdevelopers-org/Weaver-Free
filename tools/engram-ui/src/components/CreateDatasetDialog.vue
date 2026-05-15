<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="open" @hide="reset">
    <q-card style="min-width: 480px; max-width: 600px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="mdi-database-plus-outline" class="q-mr-xs" />
          New dataset
        </div>
        <q-space />
        <q-btn icon="mdi-close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Dataset name -->
        <q-input
          v-model="name"
          outlined
          dense
          label="Dataset name"
          hint="Lowercase letters, digits, hyphens, underscores"
          :rules="[nameRule]"
          lazy-rules
          class="q-mb-md"
          autofocus
        >
          <template #prepend>
            <q-icon name="mdi-database" size="16px" />
          </template>
        </q-input>

        <!-- Strategy selection -->
        <div class="text-overline text-grey-7 q-mb-sm">Processing strategy</div>
        <div class="strategy-list">
          <div
            v-for="opt in strategyOptions"
            :key="opt.strategy"
            class="strategy-card q-pa-sm q-mb-xs"
            :class="{ 'strategy-card--selected': selectedStrategy === opt.strategy, 'strategy-card--disabled': !opt.feasible }"
            @click="opt.feasible && (selectedStrategy = opt.strategy)"
          >
            <div class="row items-start no-wrap">
              <q-radio
                :model-value="selectedStrategy"
                :val="opt.strategy"
                :disable="!opt.feasible"
                @update:model-value="selectedStrategy = opt.strategy"
                class="q-mr-xs"
                dense
              />
              <q-icon
                :name="opt.icon"
                :color="opt.feasible ? opt.color : 'grey-5'"
                size="20px"
                class="q-mr-sm q-mt-xxs flex-shrink-0"
              />
              <div class="col">
                <div class="text-body2 text-weight-medium" :class="opt.feasible ? `text-${opt.color}` : 'text-grey-5'">
                  {{ opt.label }}
                </div>
                <div class="text-caption text-grey-6">{{ opt.caption }}</div>
                <div v-if="!opt.feasible" class="text-caption text-orange-7 q-mt-xxs">
                  <q-icon name="mdi-alert-outline" size="12px" class="q-mr-xxs" />
                  {{ opt.unavailableReason }}
                </div>
                <div v-else-if="opt.strategy !== 'embed-only'" class="text-caption text-green-7 q-mt-xxs">
                  <q-icon name="mdi-check-circle-outline" size="12px" class="q-mr-xxs" />
                  Infrastructure ready
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn
          color="primary"
          label="Create dataset"
          icon="mdi-database-plus-outline"
          :loading="loading"
          :disable="!nameValid || !selectedStrategy"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ProcessingStrategy } from '../composables/useEngram'
import type { EngramInfrastructure } from '../composables/useEngramMonitor'

const STRATEGY_OPTIONS: Array<{
  strategy: ProcessingStrategy
  label: string
  icon: string
  color: string
  caption: string
  needsEmbedding: boolean
  needsPipeline: boolean
}> = [
  {
    strategy: 'embed-only',
    label: 'Embed only',
    icon: 'mdi-lightning-bolt',
    color: 'teal',
    caption: 'Files uploaded and indexed via the ingest script. Fast, lightweight.',
    needsEmbedding: false,
    needsPipeline: false,
  },
  {
    strategy: 'embed+graph',
    label: 'Embed + graph',
    icon: 'mdi-graph-outline',
    color: 'blue',
    caption: 'Cognee builds vector embeddings and a relationship graph. Richer recall.',
    needsEmbedding: true,
    needsPipeline: false,
  },
  {
    strategy: 'full-cognify',
    label: 'Full cognify',
    icon: 'mdi-brain',
    color: 'deep-purple',
    caption: 'Full entity extraction pipeline. Slowest, richest output.',
    needsEmbedding: true,
    needsPipeline: true,
  },
]

const NAME_REGEX = /^[a-z][a-z0-9_-]*$/

const props = defineProps<{
  modelValue: boolean
  initialName?: string
  infrastructure: EngramInfrastructure | null
  infraLoading: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  submit: [name: string, strategy: ProcessingStrategy]
}>()

const open = ref(props.modelValue)
const name = ref(props.initialName ?? '')
const selectedStrategy = ref<ProcessingStrategy>('embed-only')

watch(() => props.modelValue, (v) => { open.value = v })
watch(open, (v) => emit('update:modelValue', v))
watch(() => props.initialName, (v) => { if (v) name.value = v })

const nameValid = computed(() => NAME_REGEX.test(name.value.trim()) && name.value.trim().length <= 64)

function nameRule(val: string): true | string {
  if (!val.trim()) return 'Name is required'
  if (!NAME_REGEX.test(val.trim())) return 'Lowercase letters, digits, hyphens, underscores only; must start with a letter'
  if (val.trim().length > 64) return 'Max 64 characters'
  return true
}

const strategyOptions = computed(() =>
  STRATEGY_OPTIONS.map((opt) => {
    const infra = props.infrastructure
    const embeddingOk = infra ? infra.embedding.available : false
    const pipelineOk = infra ? infra.pipeline.available : false
    const feasible =
      !opt.needsEmbedding ||
      (embeddingOk && (!opt.needsPipeline || pipelineOk))
    let unavailableReason = ''
    if (!feasible) {
      if (opt.needsPipeline && !pipelineOk && !embeddingOk) unavailableReason = 'Embedding + pipeline not available'
      else if (opt.needsPipeline && !pipelineOk) unavailableReason = 'Pipeline service not available'
      else unavailableReason = 'Embedding service not available'
    }
    return { ...opt, feasible, unavailableReason }
  }),
)

function reset() {
  name.value = props.initialName ?? ''
  selectedStrategy.value = 'embed-only'
}

function onSubmit() {
  if (!nameValid.value) return
  emit('submit', name.value.trim(), selectedStrategy.value)
}
</script>

<style scoped>
.strategy-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.strategy-card:hover:not(.strategy-card--disabled) {
  background: rgba(0, 0, 0, 0.03);
}
.strategy-card--selected {
  border-color: rgba(var(--q-primary-rgb, 33, 150, 243), 0.5);
  background: rgba(var(--q-primary-rgb, 33, 150, 243), 0.05);
}
.strategy-card--disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
