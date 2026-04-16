<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-list class="notification-panel" style="min-width: 320px; max-width: 400px">
    <!-- Header -->
    <q-item-label header class="row items-center justify-between q-py-sm">
      <span class="text-weight-bold">Notifications</span>
      <div v-if="store.notifications.length > 0" class="row q-gutter-xs">
        <q-btn
          flat dense size="sm" no-caps
          label="Mark all read"
          @click="store.markAllRead()"
        />
        <q-btn
          flat dense size="sm" no-caps
          color="negative"
          label="Clear all"
          @click="confirmClearAll"
        />
      </div>
    </q-item-label>

    <q-separator />

    <!-- Empty state -->
    <div v-if="store.notifications.length === 0" class="q-pa-md text-center text-grey-8">
      No notifications yet
    </div>

    <!-- Notification list -->
    <div v-else style="max-height: 400px; overflow-y: auto">
      <template v-for="(item, idx) in store.recentNotifications" :key="item.id">
        <q-separator v-if="idx > 0" />
        <q-item :class="{ 'bg-blue-1': !store.readIdSet.has(item.id) }" dense>
          <q-item-section side class="q-pr-xs" style="min-width: 24px">
            <q-checkbox
              :model-value="selectedIds.has(item.id)"
              dense
              size="xs"
              @update:model-value="toggleSelect(item.id, $event)"
            />
          </q-item-section>
          <q-item-section avatar style="min-width: 28px">
            <q-icon
              :name="severityIcon(item.severity)"
              :color="severityColor(item.severity)"
              size="20px"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ item.message }}</q-item-label>
            <q-item-label caption>{{ formatTimestamp(item.timestamp) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs no-wrap">
              <q-btn
                v-if="!store.readIdSet.has(item.id)"
                flat dense round size="xs"
                icon="mdi-check"
                @click.stop="store.markRead(item.id)"
              >
                <q-tooltip>Mark as read</q-tooltip>
              </q-btn>
              <q-btn
                flat dense round size="xs"
                icon="mdi-close"
                color="grey"
                @click.stop="store.removeNotification(item.id)"
              >
                <q-tooltip>Dismiss</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </template>
    </div>

    <!-- Bulk action strip -->
    <template v-if="selectedIds.size > 0">
      <q-separator />
      <div class="row items-center q-pa-xs q-px-sm q-gutter-xs bulk-strip">
        <span class="text-body2 text-weight-medium">
          {{ selectedIds.size }} selected
        </span>
        <q-space />
        <q-btn
          flat dense no-caps size="sm"
          label="Mark read"
          icon="mdi-check-all"
          @click="markSelectedRead"
        />
        <q-btn
          flat dense no-caps size="sm"
          color="negative"
          label="Delete"
          icon="mdi-delete"
          @click="deleteSelected"
        />
        <q-btn flat dense round size="xs" icon="mdi-close" @click="selectedIds.clear()">
          <q-tooltip>Clear selection</q-tooltip>
        </q-btn>
      </div>
    </template>
  </q-list>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useQuasar } from 'quasar'
import { useNotificationStore } from 'src/stores/notification-store'
import type { NotificationSeverity } from 'src/types/notification'

const $q = useQuasar()
const store = useNotificationStore()

const selectedIds = reactive(new Set<string>())

function toggleSelect(id: string, checked: boolean | null) {
  if (checked) {
    selectedIds.add(id)
  } else {
    selectedIds.delete(id)
  }
}

function confirmClearAll() {
  const count = store.notifications.length
  $q.dialog({
    title: 'Clear All Notifications',
    message: `Remove all ${count} notification${count !== 1 ? 's' : ''}?`,
    cancel: true,
    persistent: false,
    color: 'negative',
  }).onOk(() => {
    store.clearAll()
    selectedIds.clear()
  })
}

function markSelectedRead() {
  for (const id of selectedIds) {
    store.markRead(id)
  }
  selectedIds.clear()
}

function deleteSelected() {
  store.removeNotifications([...selectedIds])
  selectedIds.clear()
}

function severityIcon(severity: NotificationSeverity): string {
  switch (severity) {
    case 'error': return 'mdi-alert-circle'
    case 'warning': return 'mdi-alert'
    case 'success': return 'mdi-check-circle'
    default: return 'mdi-information'
  }
}

function severityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case 'error': return 'negative'
    case 'warning': return 'warning'
    case 'success': return 'positive'
    default: return 'info'
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString()
}
</script>

<style scoped lang="scss">
.body--dark .bg-blue-1 {
  background: rgba(25, 118, 210, 0.12) !important;
}
.bulk-strip {
  background: rgba(var(--q-primary-rgb, 25, 118, 210), 0.05);
}
</style>
