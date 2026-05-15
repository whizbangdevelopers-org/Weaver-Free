<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="open" @hide="reset">
    <q-card style="min-width: 520px; max-width: 660px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="mdi-arrow-up-circle-outline" class="q-mr-xs" />
          Upgrade dataset
        </div>
        <q-space />
        <q-btn icon="mdi-close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Dataset + strategy path -->
        <div class="text-body2 text-grey-7 q-mb-sm">
          Dataset: <span class="text-weight-medium text-dark">{{ datasetName }}</span>
        </div>

        <div class="strategy-path row items-center q-mb-md">
          <div
            v-for="(s, i) in STRATEGY_ORDER"
            :key="s"
            class="row items-center"
          >
            <div
              class="strategy-chip q-px-sm q-py-xxs"
              :class="strategyChipClass(s)"
            >
              <q-icon :name="STRATEGY_META[s].icon" size="14px" class="q-mr-xxs" />
              {{ STRATEGY_META[s].label }}
            </div>
            <q-icon
              v-if="i < STRATEGY_ORDER.length - 1"
              name="mdi-chevron-right"
              size="18px"
              color="grey-5"
              class="q-mx-xs"
            />
          </div>
        </div>

        <!-- Target strategy selection (only if multiple targets available) -->
        <div v-if="upgradeTargets.length > 1" class="q-mb-md">
          <div class="text-overline text-grey-7 q-mb-xs">Upgrade to</div>
          <div class="row q-gutter-xs">
            <q-btn
              v-for="t in upgradeTargets"
              :key="t"
              :outline="selectedTarget !== t"
              :color="selectedTarget === t ? STRATEGY_META[t].color : 'grey-5'"
              :icon="STRATEGY_META[t].icon"
              :label="STRATEGY_META[t].label"
              dense
              no-caps
              @click="selectedTarget = t"
            />
          </div>
        </div>

        <!-- Method selection -->
        <div class="text-overline text-grey-7 q-mb-sm">Upgrade method</div>
        <div class="method-list">
          <div
            v-for="m in methodOptions"
            :key="m.key"
            class="method-card q-pa-sm q-mb-xs"
            :class="{ 'method-card--selected': selectedMethod === m.key }"
            @click="selectedMethod = m.key"
          >
            <div class="row items-start no-wrap">
              <q-radio
                :model-value="selectedMethod"
                :val="m.key"
                @update:model-value="selectedMethod = m.key"
                dense
                class="q-mr-xs"
              />
              <div class="col">
                <div class="row items-center q-gutter-xs">
                  <span class="text-body2 text-weight-medium">{{ m.label }}</span>
                  <q-chip
                    v-if="m.feasible"
                    dense
                    color="green-1"
                    text-color="green-8"
                    icon="mdi-check-circle-outline"
                    size="sm"
                    class="q-pa-xs"
                  >Ready</q-chip>
                  <q-chip
                    v-else
                    dense
                    color="orange-1"
                    text-color="orange-8"
                    icon="mdi-clock-outline"
                    size="sm"
                    class="q-pa-xs"
                  >Will queue</q-chip>
                </div>
                <div class="text-caption text-grey-6">{{ m.description }}</div>
                <div v-if="!m.feasible" class="text-caption text-orange-7 q-mt-xxs">
                  <q-icon name="mdi-information-outline" size="11px" class="q-mr-xxs" />
                  Requires: {{ m.missingServices }}. Job will queue until available.
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn
          :color="isImmediateStart ? 'primary' : 'orange-7'"
          :icon="isImmediateStart ? 'mdi-play-circle-outline' : 'mdi-clock-outline'"
          :label="isImmediateStart ? 'Start upgrade' : 'Queue upgrade'"
          :loading="loading"
          :disable="!selectedMethod || !selectedTarget"
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

type UpgradeMethod = 'gradual' | 'additive' | 'priorityTrickle' | 'bulkReprocess' | 'parallelAtomic'

const STRATEGY_ORDER: ProcessingStrategy[] = ['embed-only', 'embed+graph', 'full-cognify']

const STRATEGY_META: Record<ProcessingStrategy, { label: string; icon: string; color: string }> = {
  'embed-only':   { label: 'Embed only',   icon: 'mdi-lightning-bolt', color: 'teal'        },
  'embed+graph':  { label: 'Embed + graph', icon: 'mdi-graph-outline',  color: 'blue'        },
  'full-cognify': { label: 'Full cognify', icon: 'mdi-brain',           color: 'deep-purple' },
}

interface MethodDef {
  key: UpgradeMethod
  label: string
  description: string
  needsEmbedding: boolean
  needsPipeline: boolean
  needsPgvector: boolean
}

const METHODS: MethodDef[] = [
  {
    key: 'gradual',
    label: 'Gradual',
    description: 'New files use the higher strategy; existing embeddings are left in place.',
    needsEmbedding: false,
    needsPipeline: false,
    needsPgvector: false,
  },
  {
    key: 'additive',
    label: 'Additive',
    description: 'Adds graph/vector embeddings to existing entries without full reprocessing.',
    needsEmbedding: true,
    needsPipeline: false,
    needsPgvector: false,
  },
  {
    key: 'priorityTrickle',
    label: 'Priority trickle',
    description: 'Slowly reprocesses high-priority entries in the background. Low resource use.',
    needsEmbedding: true,
    needsPipeline: true,
    needsPgvector: false,
  },
  {
    key: 'bulkReprocess',
    label: 'Bulk reprocess',
    description: 'Reprocesses all entries at once. Fastest completion, highest resource use.',
    needsEmbedding: true,
    needsPipeline: true,
    needsPgvector: false,
  },
  {
    key: 'parallelAtomic',
    label: 'Parallel atomic',
    description: 'Builds a parallel snapshot, then swaps atomically. Zero-downtime upgrade.',
    needsEmbedding: true,
    needsPipeline: true,
    needsPgvector: true,
  },
]

const props = defineProps<{
  modelValue: boolean
  datasetName: string
  currentStrategy: ProcessingStrategy
  infrastructure: EngramInfrastructure | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  submit: [name: string, targetStrategy: ProcessingStrategy, method: string]
}>()

const open = ref(props.modelValue)
const selectedMethod = ref<UpgradeMethod>('gradual')
const selectedTarget = ref<ProcessingStrategy | null>(null)

// Declare before the immediate watch that reads it (eager-eval-tdz rule)
const upgradeTargets = computed<ProcessingStrategy[]>(() => {
  const idx = STRATEGY_ORDER.indexOf(props.currentStrategy)
  return STRATEGY_ORDER.slice(idx + 1)
})

watch(() => props.modelValue, (v) => { open.value = v })
watch(open, (v) => emit('update:modelValue', v))

// Auto-set initial target when dialog opens or dataset changes
watch([() => props.modelValue, () => props.currentStrategy], ([isOpen]) => {
  if (isOpen && upgradeTargets.value.length > 0) {
    selectedTarget.value = upgradeTargets.value[upgradeTargets.value.length - 1] ?? null
  }
}, { immediate: true })

const methodOptions = computed(() => {
  const infra = props.infrastructure
  const embeddingOk = infra?.embedding.available ?? false
  const pipelineOk = infra?.pipeline.available ?? false
  const pgvectorOk = infra?.pgvector.available ?? false

  return METHODS.map((m) => {
    const feasible =
      (!m.needsEmbedding || embeddingOk) &&
      (!m.needsPipeline || pipelineOk) &&
      (!m.needsPgvector || pgvectorOk)

    const missing: string[] = []
    if (m.needsEmbedding && !embeddingOk) missing.push('embedding')
    if (m.needsPipeline && !pipelineOk) missing.push('pipeline')
    if (m.needsPgvector && !pgvectorOk) missing.push('pgvector')

    return { ...m, feasible, missingServices: missing.join(', ') }
  })
})

const isImmediateStart = computed(() => {
  const m = methodOptions.value.find((o) => o.key === selectedMethod.value)
  return m?.feasible ?? false
})

function strategyChipClass(s: ProcessingStrategy): string {
  const isCurrent = s === props.currentStrategy
  const isTarget = s === selectedTarget.value
  const idx = STRATEGY_ORDER.indexOf(s)
  const currentIdx = STRATEGY_ORDER.indexOf(props.currentStrategy)
  const isPast = idx < currentIdx
  if (isCurrent) return 'strategy-chip--current'
  if (isTarget) return 'strategy-chip--target'
  if (isPast) return 'strategy-chip--past'
  return 'strategy-chip--future'
}

function reset() {
  selectedMethod.value = 'gradual'
  if (upgradeTargets.value.length > 0) {
    selectedTarget.value = upgradeTargets.value[upgradeTargets.value.length - 1] ?? null
  }
}

function onSubmit() {
  if (!selectedMethod.value || !selectedTarget.value) return
  emit('submit', props.datasetName, selectedTarget.value, selectedMethod.value)
}

defineExpose({ upgradeTargets, methodOptions, isImmediateStart, selectedMethod, selectedTarget, onSubmit })
</script>

<style scoped>
.strategy-path {
  flex-wrap: wrap;
  gap: 2px;
}
.strategy-chip {
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
}
.strategy-chip--past {
  background: rgba(0, 0, 0, 0.06);
  color: #9e9e9e;
  border-color: rgba(0, 0, 0, 0.1);
}
.strategy-chip--current {
  background: rgba(var(--q-primary-rgb, 33, 150, 243), 0.15);
  color: #1565c0;
  border-color: rgba(var(--q-primary-rgb, 33, 150, 243), 0.4);
}
.strategy-chip--target {
  background: rgba(76, 175, 80, 0.12);
  color: #2e7d32;
  border-color: rgba(76, 175, 80, 0.4);
}
.strategy-chip--future {
  background: transparent;
  color: #9e9e9e;
  border-color: rgba(0, 0, 0, 0.1);
}
.method-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.method-card:hover {
  background: rgba(0, 0, 0, 0.03);
}
.method-card--selected {
  border-color: rgba(var(--q-primary-rgb, 33, 150, 243), 0.5);
  background: rgba(var(--q-primary-rgb, 33, 150, 243), 0.05);
}
</style>
