<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="q-gutter-md">
    <div v-if="loading" class="q-pa-lg text-center">
      <q-spinner color="primary" size="32px" />
    </div>

    <div v-else-if="loadError" class="q-pa-md">
      <q-banner rounded class="bg-negative text-white">
        {{ loadError }}
      </q-banner>
    </div>

    <template v-else-if="config">
      <q-separator class="q-my-sm" />
      <div class="text-subtitle2">Push Channels</div>

      <!-- Configured channels list -->
      <q-list v-if="pushChannels.length > 0" bordered separator class="rounded-borders">
        <q-expansion-item
          v-for="[channelId, channel] in pushChannels"
          :key="channelId"
          :label="channelLabel(channel.type)"
          :caption="channelId"
          :icon="channelIcon(channel.type)"
          group="channels"
        >
          <q-card>
            <q-card-section class="q-gutter-sm">
              <div class="row items-center q-gutter-sm">
                <q-toggle
                  :model-value="channel.enabled"
                  label="Enabled"
                  @update:model-value="toggleChannel(channelId, channel, $event)"
                />
              </div>

              <!-- Channel-specific fields (read-only summary) -->
              <div class="text-caption text-grey-8">
                <template v-if="channel.type === 'ntfy'">
                  URL: {{ channel.url }} / Topic: {{ channel.topic }}
                </template>
                <template v-else-if="channel.type === 'email'">
                  SMTP: {{ channel.smtpHost }}:{{ channel.smtpPort }} / From: {{ channel.fromAddress }}
                </template>
                <template v-else-if="channel.type === 'webhook'">
                  {{ channel.method }} {{ channel.url }} ({{ channel.format }})
                </template>
                <template v-else-if="channel.type === 'web-push'">
                  VAPID configured
                </template>
              </div>

              <div class="text-caption">
                Events: {{ channel.events.length }} subscribed
              </div>

              <div class="row q-gutter-sm q-mt-sm">
                <q-btn
                  flat dense color="primary" icon="mdi-pencil" label="Edit" no-caps
                  @click="openEditDialog(channelId, channel)"
                />
                <q-btn
                  flat dense color="primary" icon="mdi-send" label="Test" no-caps
                  :loading="testingChannel === channelId"
                  @click="doTestChannel(channelId)"
                />
                <q-btn
                  flat dense color="negative" icon="mdi-delete" label="Remove" no-caps
                  @click="confirmRemove(channelId)"
                />
              </div>

              <!-- Test result -->
              <q-banner
                v-if="testResults[channelId] !== undefined"
                dense rounded
                :class="testResults[channelId] ? 'bg-positive text-white' : 'bg-negative text-white'"
                class="q-mt-sm"
              >
                {{ testResults[channelId] ? 'Test successful' : 'Test failed' }}
              </q-banner>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>

      <div v-else class="text-caption text-grey-8 q-pa-sm">
        No push channels configured. Add one below.
      </div>

      <!-- Add channel button -->
      <q-btn flat color="primary" icon="mdi-plus" label="Add Channel" no-caps @click="openAddDialog" />

      <!-- Resource Alerts -->
      <q-separator class="q-my-sm" />
      <div class="text-subtitle2">Resource Alerts</div>
      <div class="q-gutter-sm" style="max-width: 400px">
        <div>
          <div class="text-caption">CPU Threshold: {{ config.resourceAlerts.cpuThresholdPercent }}%</div>
          <q-slider
            :model-value="config.resourceAlerts.cpuThresholdPercent"
            :min="10" :max="100" :step="5" label
            @change="updateResourceAlert('cpuThresholdPercent', $event)"
          />
        </div>
        <div>
          <div class="text-caption">Memory Threshold: {{ config.resourceAlerts.memoryThresholdPercent }}%</div>
          <q-slider
            :model-value="config.resourceAlerts.memoryThresholdPercent"
            :min="10" :max="100" :step="5" label
            @change="updateResourceAlert('memoryThresholdPercent', $event)"
          />
        </div>
      </div>
    </template>

    <!-- Add/Edit Channel Dialog -->
    <q-dialog v-model="showDialog" persistent>
      <q-card style="min-width: 450px">
        <q-card-section>
          <div class="text-h6">{{ editMode ? 'Edit' : 'Add' }} Notification Channel</div>
        </q-card-section>

        <q-form @submit.prevent="saveChannel">
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="form.type"
            :options="channelTypeOptions"
            label="Channel Type"
            emit-value map-options outlined dense
            :disable="editMode"
          />

          <q-input
            v-model="form.id"
            label="Channel ID"
            hint="Unique identifier (e.g. 'slack-alerts')"
            outlined dense
            :disable="editMode"
            :rules="[v => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(v) || 'Letters, digits, hyphens, underscores only']"
            lazy-rules
          />

          <!-- ntfy fields -->
          <template v-if="form.type === 'ntfy'">
            <q-input v-model="form.url" label="Server URL" outlined dense placeholder="https://ntfy.sh" :rules="[v => !!v || 'Required']" lazy-rules />
            <q-input v-model="form.topic" label="Topic" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-input v-model="form.token" label="Access Token (optional)" outlined dense />
          </template>

          <!-- email fields -->
          <template v-if="form.type === 'email'">
            <q-input v-model="form.smtpHost" label="SMTP Host" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-input v-model.number="form.smtpPort" label="SMTP Port" type="number" outlined dense :rules="[v => (v >= 1 && v <= 65535) || 'Must be 1–65535']" lazy-rules />
            <q-input v-model="form.smtpUser" label="SMTP User" outlined dense />
            <q-input v-model="form.smtpPass" label="SMTP Password" type="password" outlined dense />
            <q-toggle v-model="form.smtpSecure" label="Use TLS" />
            <q-input v-model="form.fromAddress" label="From Address" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-input v-model="form.recipients" label="Recipients (comma-separated)" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
          </template>

          <!-- webhook fields -->
          <template v-if="form.type === 'webhook'">
            <q-input v-model="form.url" label="Webhook URL" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-select v-model="form.method" :options="['POST', 'PUT']" label="HTTP Method" outlined dense />
            <q-select
              v-model="form.format"
              :options="webhookFormatOptions"
              label="Payload Format"
              emit-value map-options outlined dense
            />
          </template>

          <!-- web-push fields -->
          <template v-if="form.type === 'web-push'">
            <q-input v-model="form.vapidPublicKey" label="VAPID Public Key" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-input v-model="form.vapidPrivateKey" label="VAPID Private Key" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-input v-model="form.vapidSubject" label="VAPID Subject (mailto: or URL)" outlined dense :rules="[v => !!v || 'Required']" lazy-rules />
            <q-btn flat dense color="primary" label="Generate VAPID Keys" no-caps @click="doGenerateVapidKeys" />
          </template>

          <!-- Event selection -->
          <div class="text-subtitle2 q-mt-sm">Subscribed Events</div>
          <div class="q-gutter-xs">
            <template v-for="(events, category) in eventCategories" :key="category">
              <div class="text-caption text-grey-8 q-mt-xs" style="text-transform: capitalize">{{ category }}</div>
              <q-checkbox
                v-for="evt in events"
                :key="evt"
                :model-value="form.events.includes(evt)"
                :label="evt"
                dense
                @update:model-value="toggleFormEvent(evt, $event as boolean)"
              />
            </template>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showDialog = false" no-caps />
          <q-btn
            flat color="primary"
            :label="editMode ? 'Save' : 'Add Channel'"
            no-caps :loading="saving"
            type="submit"
          />
        </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { notificationApiService } from 'src/services/api'
import { isDemoMode } from 'src/config/demo'
import type {
  NotificationChannelConfigData,
  ChannelConfig,
  NotificationEventType,
} from 'src/types/notification'
import { EVENT_CATEGORIES } from 'src/types/notification'

const $q = useQuasar()

const loading = ref(true)
const loadError = ref<string | null>(null)
const config = ref<NotificationChannelConfigData | null>(null)
const saving = ref(false)
const testingChannel = ref<string | null>(null)
const testResults = ref<Record<string, boolean>>({})
const showDialog = ref(false)
const editMode = ref(false)

const eventCategories = EVENT_CATEGORIES

const channelTypeOptions = [
  { label: 'ntfy', value: 'ntfy' },
  { label: 'Email (SMTP)', value: 'email' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'Web Push', value: 'web-push' },
]

const webhookFormatOptions = [
  { label: 'JSON', value: 'json' },
  { label: 'Slack', value: 'slack' },
  { label: 'Discord', value: 'discord' },
  { label: 'PagerDuty', value: 'pagerduty' },
]

const ALL_EVENTS: NotificationEventType[] = Object.values(EVENT_CATEGORIES).flat() as NotificationEventType[]

interface FormData {
  type: string
  id: string
  url: string
  topic: string
  token: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  fromAddress: string
  recipients: string
  method: string
  format: string
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
  events: NotificationEventType[]
}

function defaultForm(): FormData {
  return {
    type: 'ntfy', id: '', url: '', topic: '', token: '',
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '',
    smtpSecure: true, fromAddress: '', recipients: '',
    method: 'POST', format: 'json',
    vapidPublicKey: '', vapidPrivateKey: '', vapidSubject: '',
    events: [...ALL_EVENTS],
  }
}

const form = ref<FormData>(defaultForm())

const pushChannels = computed<[string, ChannelConfig][]>(() => {
  if (!config.value) return []
  return Object.entries(config.value.channels).filter(([id]) => id !== 'in-app')
})

function channelLabel(type: string): string {
  return { ntfy: 'ntfy', email: 'Email (SMTP)', webhook: 'Webhook', 'web-push': 'Web Push' }[type] || type
}

function channelIcon(type: string): string {
  return { ntfy: 'mdi-bell-ring', email: 'mdi-email', webhook: 'mdi-webhook', 'web-push': 'mdi-cellphone-message' }[type] || 'mdi-bell'
}

function toggleFormEvent(evt: NotificationEventType, checked: boolean) {
  if (checked && !form.value.events.includes(evt)) {
    form.value.events.push(evt)
  } else if (!checked) {
    form.value.events = form.value.events.filter(e => e !== evt)
  }
}

async function loadConfig() {
  if (isDemoMode()) {
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = null
  try {
    config.value = await notificationApiService.getConfig()
  } catch {
    loadError.value = 'Failed to load notification configuration'
  } finally {
    loading.value = false
  }
}

async function toggleChannel(channelId: string, channel: ChannelConfig, enabled: boolean) {
  try {
    await notificationApiService.setChannel(channelId, { ...channel, enabled })
    await loadConfig()
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update channel' })
  }
}

async function doTestChannel(channelId: string) {
  testingChannel.value = channelId
  delete testResults.value[channelId]
  try {
    const result = await notificationApiService.testChannel(channelId)
    testResults.value[channelId] = result.success
  } catch {
    testResults.value[channelId] = false
  } finally {
    testingChannel.value = null
  }
}

function confirmRemove(channelId: string) {
  $q.dialog({
    title: 'Remove Channel',
    message: `Remove notification channel "${channelId}"? This cannot be undone.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await notificationApiService.removeChannel(channelId)
      await loadConfig()
      $q.notify({ type: 'positive', message: `Channel "${channelId}" removed` })
    } catch {
      $q.notify({ type: 'negative', message: 'Failed to remove channel' })
    }
  })
}

function openAddDialog() {
  editMode.value = false
  form.value = defaultForm()
  showDialog.value = true
}

function openEditDialog(channelId: string, channel: ChannelConfig) {
  editMode.value = true
  const f = defaultForm()
  f.id = channelId
  f.type = channel.type
  f.events = [...channel.events]

  if (channel.type === 'ntfy') {
    f.url = channel.url
    f.topic = channel.topic
    f.token = channel.token || ''
  } else if (channel.type === 'email') {
    f.smtpHost = channel.smtpHost
    f.smtpPort = channel.smtpPort
    f.smtpUser = channel.smtpUser
    f.smtpPass = channel.smtpPass
    f.smtpSecure = channel.smtpSecure
    f.fromAddress = channel.fromAddress
    f.recipients = channel.recipients.join(', ')
  } else if (channel.type === 'webhook') {
    f.url = channel.url
    f.method = channel.method
    f.format = channel.format
  } else if (channel.type === 'web-push') {
    f.vapidPublicKey = channel.vapidPublicKey
    f.vapidPrivateKey = channel.vapidPrivateKey
    f.vapidSubject = channel.vapidSubject
  }

  form.value = f
  showDialog.value = true
}

async function saveChannel() {
  saving.value = true
  try {
    const f = form.value
    if (!f.id || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(f.id)) {
      $q.notify({ type: 'negative', message: 'Valid Channel ID is required' })
      return
    }
    if (f.events.length === 0) {
      $q.notify({ type: 'negative', message: 'At least one event is required' })
      return
    }

    let channelConfig: ChannelConfig
    switch (f.type) {
      case 'ntfy':
        channelConfig = {
          type: 'ntfy', enabled: true, events: f.events,
          url: f.url, topic: f.topic, ...(f.token ? { token: f.token } : {}),
        }
        break
      case 'email':
        channelConfig = {
          type: 'email', enabled: true, events: f.events,
          smtpHost: f.smtpHost, smtpPort: f.smtpPort, smtpUser: f.smtpUser, smtpPass: f.smtpPass,
          smtpSecure: f.smtpSecure, fromAddress: f.fromAddress,
          recipients: f.recipients.split(',').map(s => s.trim()).filter(Boolean),
        }
        break
      case 'webhook':
        channelConfig = {
          type: 'webhook', enabled: true, events: f.events,
          url: f.url, method: f.method as 'POST' | 'PUT',
          format: f.format as 'json' | 'slack' | 'discord' | 'pagerduty',
        }
        break
      case 'web-push':
        channelConfig = {
          type: 'web-push', enabled: true, events: f.events,
          vapidPublicKey: f.vapidPublicKey, vapidPrivateKey: f.vapidPrivateKey, vapidSubject: f.vapidSubject,
        }
        break
      default:
        $q.notify({ type: 'negative', message: 'Unknown channel type' })
        return
    }

    await notificationApiService.setChannel(f.id, channelConfig)
    showDialog.value = false
    await loadConfig()
    $q.notify({ type: 'positive', message: `Channel "${f.id}" saved` })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to save channel' })
  } finally {
    saving.value = false
  }
}

async function doGenerateVapidKeys() {
  try {
    const keys = await notificationApiService.generateVapidKeys()
    form.value.vapidPublicKey = keys.publicKey
    form.value.vapidPrivateKey = keys.privateKey
    $q.notify({ type: 'positive', message: 'VAPID keys generated' })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to generate VAPID keys' })
  }
}

async function updateResourceAlert(field: string, value: number) {
  try {
    const result = await notificationApiService.updateResourceAlerts({ [field]: value })
    if (config.value) {
      config.value.resourceAlerts = result.resourceAlerts
    }
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update resource alerts' })
  }
}

onMounted(() => {
  loadConfig()
})
</script>
