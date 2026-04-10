<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="dialogVisible" persistent maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card class="agent-dialog column">
      <q-card-section class="row items-center q-pb-sm">
        <div class="col">
          <div class="text-h6">
            <q-icon :name="actionIcon" class="q-mr-sm" />
            {{ actionTitle }} &mdash; {{ resourceId }}
          </div>
        </div>
        <q-btn flat round dense icon="mdi-close" @click="close" :disable="isRunning" />
      </q-card-section>

      <q-separator />

      <!-- Key source indicator -->
      <div class="row items-center q-px-md q-pt-sm q-gutter-xs">
        <q-chip
          v-if="appStore.serverKeyAllowed && settingsStore.useServerKey"
          dense size="sm" icon="mdi-server" color="primary" text-color="white"
        >Server key</q-chip>
        <q-chip
          v-else-if="settingsStore.hasUserKey"
          dense size="sm" icon="mdi-key" color="teal" text-color="white"
        >Your API key</q-chip>
        <q-chip
          v-else
          dense size="sm" icon="mdi-test-tube" color="grey" text-color="white"
        >Mock mode</q-chip>
      </div>

      <!-- BYOK prompt for free-tier users without a personal key -->
      <q-banner v-if="showByokPrompt" rounded class="bg-orange-1 text-orange-9 q-mx-md q-mt-sm">
        <template #avatar>
          <q-icon name="mdi-key" color="orange" />
        </template>
        <div class="text-weight-medium">API key required</div>
        <div class="text-body2 q-mt-xs">
          Server AI key requires Weaver Solo or higher. Provide your own key (BYOK) in
          <router-link to="/settings" class="text-primary text-weight-medium">Settings &gt; AI Provider</router-link>.
        </div>
        <div class="text-caption text-orange-7 q-mt-xs">
          Your key is stored in your browser only. You are responsible for its security and all costs incurred.
          <router-link to="/docs/terms-of-service" class="text-orange-9">Terms of Service</router-link>.
        </div>
      </q-banner>

      <q-card-section class="agent-output col scroll" ref="outputRef">
        <div v-if="operation" class="text-body1 agent-text" style="white-space: pre-wrap;">{{ operation.tokens }}</div>
        <span v-if="isRunning" class="cursor-blink">|</span>

        <div v-if="!operation" class="text-center text-grey q-pa-xl">
          <q-spinner-dots size="40px" color="primary" />
          <div class="q-mt-md">Starting agent...</div>
        </div>

        <q-banner v-if="operation?.status === 'error'" rounded class="bg-negative text-white q-mt-md">
          <template #avatar><q-icon name="mdi-alert-circle" /></template>
          {{ operation.error }}
        </q-banner>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-badge
          v-if="operation?.status === 'complete'"
          color="positive"
          label="Complete"
          rounded
          class="q-mr-auto"
        />
        <q-badge
          v-if="operation?.status === 'error'"
          color="negative"
          label="Error"
          rounded
          class="q-mr-auto"
        />
        <q-btn flat label="Close" :disable="isRunning" @click="close" />
        <q-btn
          flat
          label="Copy"
          icon="mdi-content-copy"
          @click="copyOutput"
          :disable="!operation?.tokens"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import { useAgentStore } from 'src/stores/agent-store'
import { useAppStore } from 'src/stores/app'
import { useSettingsStore } from 'src/stores/settings-store'
import type { AgentAction } from 'src/types/agent'

const props = defineProps<{
  modelValue: boolean
  resourceId: string
  action: AgentAction
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const $q = useQuasar()
const agentStore = useAgentStore()
const appStore = useAppStore()
const settingsStore = useSettingsStore()
const outputRef = ref<{ $el?: HTMLElement } | null>(null)

/** Show BYOK prompt when: server has a key, tier can't use it, and user has no personal key */
const showByokPrompt = computed(() =>
  appStore.hasServerKey && !appStore.serverKeyAllowed && !settingsStore.hasUserKey,
)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const operation = computed(() => agentStore.activeOperation)
const isRunning = computed(() => agentStore.hasActiveOperation)

const actionTitle = computed((): string => {
  switch (props.action) {
    case 'diagnose': return 'AI Diagnosis'
    case 'explain': return 'AI Explanation'
    case 'suggest': return 'AI Suggestions'
    default: return 'AI Analysis'
  }
})

const actionIcon = computed((): string => {
  switch (props.action) {
    case 'diagnose': return 'mdi-stethoscope'
    case 'explain': return 'mdi-information'
    case 'suggest': return 'mdi-lightbulb'
    default: return 'mdi-robot'
  }
})

// Auto-scroll as tokens arrive
watch(
  () => operation.value?.tokens,
  async () => {
    await nextTick()
    const el = outputRef.value?.$el || outputRef.value as unknown as HTMLElement
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }
)

function close() {
  dialogVisible.value = false
}

function copyOutput() {
  if (operation.value?.tokens) {
    void navigator.clipboard.writeText(operation.value.tokens)
    $q.notify({
      type: 'positive',
      message: 'Copied to clipboard',
      position: 'top-right',
      timeout: 2000,
    })
  }
}
</script>

<style scoped lang="scss">
.agent-dialog {
  max-height: 100vh;
}

.agent-output {
  min-height: 200px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

.agent-text {
  word-break: break-word;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
  font-weight: bold;
  color: var(--q-primary);
}

@keyframes blink {
  50% { opacity: 0; }
}

.body--dark .agent-output {
  background: #1a1a1a;
}
</style>
