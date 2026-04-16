<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" persistent>
    <q-card style="width: 600px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="mdi-rocket-launch" size="28px" color="primary" class="q-mr-md" />
        <div class="text-h6">Welcome to Weaver</div>
        <q-space />
        <q-btn flat round dense icon="mdi-close" @click="dismiss" />
      </q-card-section>

      <q-card-section>
        <q-stepper
          v-model="step"
          color="primary"
          animated
          flat
        >
          <!-- Step 1: Welcome -->
          <q-step :name="1" title="Welcome" icon="mdi-hand-wave" :done="step > 1">
            <div class="text-body1 q-mb-md">
              Weaver helps you monitor and manage lightweight virtual machines on NixOS.
            </div>
            <div class="text-body2 text-grey-8 q-mb-md">
              When provisioning is enabled, Weaver automatically provisions a
              lightweight <strong>CirOS</strong> test VM (~20 MB) after your first
              admin login. You can start, stop, restart, and delete it like any
              other VM — it's a real provisioned VM, not a special case.
            </div>
            <div class="text-body2 text-grey-8 q-mb-md">
              If you don't see it yet, it may still be downloading. Look for a VM
              named <code>example-cirros</code> on the Weaver page.
            </div>
            <div class="q-gutter-sm q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="mdi-monitor-dashboard" size="24px" color="positive" class="q-mr-sm" />
                <span>Monitor VM status in real-time via WebSocket</span>
              </div>
              <div class="row items-center q-mb-sm">
                <q-icon name="mdi-play-pause" size="24px" color="primary" class="q-mr-sm" />
                <span>Start, stop, and restart VMs from your browser</span>
              </div>
              <div class="row items-center q-mb-sm">
                <q-icon name="mdi-robot" size="24px" color="info" class="q-mr-sm" />
                <span>AI-powered diagnostics and suggestions</span>
              </div>
              <div class="row items-center">
                <q-icon name="mdi-bell-outline" size="24px" color="accent" class="q-mr-sm" />
                <span>Notifications for VM state changes and alerts</span>
              </div>
            </div>

            <q-separator class="q-mb-md" />

            <div class="text-subtitle2 q-mb-sm">Discover your VMs</div>
            <div class="row items-center q-gutter-sm">
              <q-btn
                color="primary"
                icon="mdi-radar"
                label="Scan for Workloads"
                :loading="scanning"
                @click="runScan"
              />
              <span v-if="scanResult" class="text-caption">
                <span v-if="scanResult.added.length > 0" class="text-positive text-weight-medium">
                  Found {{ scanResult.added.length }} new VM(s)!
                </span>
                <span v-else class="text-grey-8">
                  No new microvm@* services found
                </span>
              </span>
            </div>
          </q-step>

          <!-- Step 2: AI Setup -->
          <q-step :name="2" title="AI Setup" icon="mdi-robot" :done="step > 2">
            <div class="text-body1 q-mb-md">
              Enable AI-powered VM diagnostics (optional).
            </div>
            <div class="text-body2 text-grey-8 q-mb-md">
              Weaver can use Claude AI to diagnose VM issues, explain configurations,
              and suggest optimizations. You can bring your own API key or use mock mode for demos.
            </div>
            <div v-if="isDemoMode()" class="q-gutter-sm">
              <q-banner rounded dense class="bg-blue-1 text-blue-9 q-mb-sm">
                <template #avatar><q-icon name="mdi-information" color="primary" /></template>
                In a live installation, this would take you to Settings to configure your API key. Press <strong>Next</strong> to continue.
              </q-banner>
            </div>
            <div v-else class="q-gutter-sm">
              <q-btn
                outline
                color="primary"
                icon="mdi-key"
                label="Configure API Key"
                @click="openSettings"
              />
              <q-btn
                flat
                color="grey"
                label="Skip — use mock mode"
                @click="step = 3"
              />
            </div>
            <div v-if="!isDemoMode()" class="text-caption text-grey-8 q-mt-sm">
              Mock mode works without any API key — great for trying things out.
            </div>
          </q-step>

          <!-- Step 3: Done -->
          <q-step :name="3" title="You're set!" icon="mdi-check-circle">
            <div class="text-body1 q-mb-md">
              You're all set to start managing VMs.
            </div>
            <div class="q-gutter-sm q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="mdi-help-circle-outline" size="20px" color="grey-7" class="q-mr-sm" />
                <span class="text-body2">
                  Look for <q-icon name="mdi-help-circle-outline" size="14px" /> icons throughout the UI for contextual help.
                </span>
              </div>
              <div class="row items-center q-mb-sm">
                <q-icon name="mdi-help-circle" size="20px" color="grey-7" class="q-mr-sm" />
                <span class="text-body2">
                  Visit the <strong>Help</strong> page from the sidebar for full guides and FAQ.
                </span>
              </div>
            </div>
            <q-toggle
              v-if="!isDemoMode()"
              v-model="dontShowAgain"
              label="Don't show this again"
            />
          </q-step>

          <template #navigation>
            <q-stepper-navigation class="row justify-end q-gutter-sm">
              <q-btn
                v-if="step > 1"
                flat
                color="primary"
                label="Back"
                @click="step--"
              />
              <q-btn
                v-if="step < 3"
                color="primary"
                label="Next"
                @click="step++"
              />
              <q-btn
                v-if="step === 3"
                color="primary"
                label="Get Started"
                icon="mdi-rocket-launch"
                @click="finish"
              />
            </q-stepper-navigation>
          </template>
        </q-stepper>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from 'src/stores/settings-store'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { isDemoMode } from 'src/config/demo'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const router = useRouter()
const settingsStore = useSettingsStore()
const { scanVms } = useWorkloadApi()

const step = ref(1)
const dontShowAgain = ref(true)
const scanning = ref(false)
const scanResult = ref<{ discovered: string[]; added: string[]; existing: string[] } | null>(null)

async function runScan() {
  scanning.value = true
  scanResult.value = await scanVms()
  scanning.value = false
}

function openSettings() {
  dismiss()
  void router.push('/settings')
}

function dismiss() {
  if (dontShowAgain.value) {
    settingsStore.dismissWizard()
  }
  emit('update:modelValue', false)
}

function finish() {
  if (dontShowAgain.value) {
    settingsStore.dismissWizard()
  }
  emit('update:modelValue', false)
}
</script>
