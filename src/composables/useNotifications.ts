// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { onMounted, onUnmounted, watch } from 'vue'
import { onWsMessage } from 'src/services/ws'
import { useNotificationStore } from 'src/stores/notification-store'
import { useAppStore } from 'src/stores/app'
import { notificationApiService } from 'src/services/api'
import { isDemoMode, getDemoNotificationsForTier } from 'src/config/demo'
import type { NotificationEvent } from 'src/types/notification'

export function useNotifications() {
  const store = useNotificationStore()
  const appStore = useAppStore()
  let removeHandler: (() => void) | null = null

  function handleMessage(msg: Record<string, unknown>) {
    if (msg.type === 'notification') {
      const event = msg.event as NotificationEvent
      if (event?.id) {
        store.addNotification(event)
      }
    }
  }

  async function loadRecent() {
    if (isDemoMode()) {
      store.setNotifications(getDemoNotificationsForTier(appStore.effectiveTier))
      return
    }
    try {
      const data = await notificationApiService.getRecent()
      store.setNotifications(data.notifications)
    } catch {
      // Backend may not be running
    }
  }

  onMounted(() => {
    if (!isDemoMode()) {
      removeHandler = onWsMessage(handleMessage)
    }
    void loadRecent()
  })

  if (isDemoMode()) {
    watch(() => appStore.effectiveTier, () => void loadRecent())
  }

  onUnmounted(() => {
    removeHandler?.()
  })

  return {
    notifications: store.recentNotifications,
    unreadCount: store.unreadCount,
    markRead: store.markRead,
    markAllRead: store.markAllRead,
  }
}
